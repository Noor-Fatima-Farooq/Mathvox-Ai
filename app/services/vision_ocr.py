import base64
import json
import os
import re

from app.services.image_preprocess import preprocess_for_ocr
from app.services.math_extract import extract_expressions_from_text, format_for_client
from app.services.ocr_validate import (
    dedupe_expressions,
    filter_single_digit_addition,
    filter_valid_expressions,
)

OCR_PROMPT = """You are a precision OCR engine for printed math worksheets (photos may be blurry).

Read the image exactly. Do NOT solve. Do NOT invent problems.

## Worksheet layout (very common)
A grid of vertical addition cells. Each cell looks like:
  [top digit on its own line]
  +[bottom digit]
  [horizontal line]
Read top digit FIRST, then bottom: top=1 and bottom=+4 means expression "1+4" (NOT "4+1").

Scan left-to-right, top-to-bottom. A "Single Digit Addition" sheet often has 12 problems (4 rows × 3 columns).

## Output — ONLY valid JSON (no markdown fences):
{
  "problem_count": 12,
  "raw_text": "title and instructions if visible",
  "expressions": ["1+4", "7+6", "7+5", "6+1", "8+5", "2+9", "9+2", "4+9", "8+3", "9+9", "5+9", "7+8"]
}

## Rules
- expressions: compact form digit+digit with + - * / only (e.g. "8+5")
- Each number in a single-digit worksheet is ONE digit 0-9
- problem_count MUST equal len(expressions)
- Include EVERY problem cell in the grid — do not stop early
- Ignore Date, Name, website footer — only math cells
- Transcribe digits carefully; do not confuse 1/7, 4/9, 8/3
"""


def _parse_llm_json(text: str) -> dict:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {"raw_text": cleaned, "expressions": []}


def _normalize_expr_list(exprs: list) -> list[str]:
    out = []
    for e in exprs:
        s = re.sub(r"\s+", "", str(e).strip())
        s = s.replace("×", "*").replace("÷", "/")
        if re.match(r"^\d+[+\-*/]\d+$", s):
            out.append(s)
    return out


def _merge_vision_expressions(exprs: list[str], raw: str) -> list[str]:
    """Prefer vision model list; only fall back to text parsing if too few."""
    exprs = dedupe_expressions(_normalize_expr_list(exprs))
    if len(exprs) >= 2:
        return exprs

    is_single_digit_sheet = bool(
        re.search(r"single\s*digit|digit\s*addition", raw or "", re.I)
    )
    if is_single_digit_sheet and exprs:
        single = filter_single_digit_addition(exprs)
        if len(single) >= len(exprs):
            exprs = single

    if len(exprs) >= 2:
        return exprs

    if raw:
        parsed = extract_expressions_from_text(raw)
        if len(parsed) > len(exprs):
            return parsed

    if raw and exprs:
        validated = filter_valid_expressions(exprs, raw)
        if validated:
            return validated

    return exprs


def _result_from_llm(llm_text: str) -> dict:
    data = _parse_llm_json(llm_text)
    raw = (data.get("raw_text") or data.get("text") or "").strip()
    exprs = _merge_vision_expressions(data.get("expressions") or [], raw)

    display = format_for_client(raw, exprs)
    if not display and raw:
        display = raw[:4000]

    return {
        "text": display,
        "expressions": exprs,
        "raw_text": raw,
        "problem_count": len(exprs),
        "source": "vision",
    }


def _vision_provider_order() -> list[str]:
    """Which vision APIs to call first (groq | gemini)."""
    explicit = (os.getenv("VISION_PROVIDER") or "").strip().lower()
    if explicit in ("groq", "gemini"):
        return [explicit]
    if os.getenv("GROQ_API_KEY") and not os.getenv("GEMINI_API_KEY"):
        return ["groq"]
    if os.getenv("GEMINI_API_KEY") and not os.getenv("GROQ_API_KEY"):
        return ["gemini"]
    if (os.getenv("LLM_PROVIDER") or "").strip().lower() == "groq":
        return ["groq", "gemini"]
    return ["gemini", "groq"]


def _ocr_with_gemini(image_bytes: bytes, mime_type: str) -> dict:
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    genai.configure(api_key=api_key)
    model_name = os.getenv(
        "GEMINI_VISION_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    )
    model = genai.GenerativeModel(model_name)
    response = model.generate_content(
        [
            OCR_PROMPT,
            {"mime_type": mime_type or "image/png", "data": image_bytes},
        ],
        generation_config={"temperature": 0},
    )
    out = _result_from_llm(response.text or "")
    out["provider"] = "gemini"
    return out


def _ocr_with_groq(image_bytes: bytes, mime_type: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    from groq import Groq

    client = Groq(api_key=api_key)
    model = os.getenv(
        "GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"
    )
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime_type or 'image/png'};base64,{b64}"

    completion = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": OCR_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        temperature=0,
    )
    text = completion.choices[0].message.content or ""
    out = _result_from_llm(text)
    out["provider"] = "groq"
    return out


def _pick_best_result(results: list[dict]) -> dict | None:
    if not results:
        return None

    prefer = _vision_provider_order()[0]

    def score(r: dict) -> int:
        n = len(r.get("expressions") or [])
        raw_len = len(r.get("raw_text") or "")
        bonus = 50 if r.get("source") == "vision" else 0
        if r.get("provider") == prefer:
            bonus += 30
        return n * 200 + raw_len + bonus

    return max(results, key=score)


def _run_vision(img_bytes: bytes, mime_type: str, provider: str) -> dict:
    if provider == "groq":
        return _ocr_with_groq(img_bytes, mime_type)
    return _ocr_with_gemini(img_bytes, mime_type)


def ocr_image(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    errors: list[str] = []
    candidates: list[dict] = []

    try:
        enhanced = preprocess_for_ocr(image_bytes)
    except Exception:
        enhanced = image_bytes

    image_variants = [enhanced, image_bytes]
    providers = _vision_provider_order()

    for img_bytes in image_variants:
        for provider in providers:
            if provider == "groq" and not os.getenv("GROQ_API_KEY"):
                continue
            if provider == "gemini" and not os.getenv("GEMINI_API_KEY"):
                continue
            try:
                result = _run_vision(img_bytes, mime_type, provider)
                if result.get("expressions") or result.get("text"):
                    candidates.append(result)
            except Exception as exc:
                label = f"{provider}: {exc}"
                if label not in errors:
                    errors.append(label)

    best = _pick_best_result(candidates)
    if best and (best.get("expressions") or best.get("text", "").strip()):
        return best

    if errors:
        raise RuntimeError("; ".join(errors))
    raise RuntimeError(
        "Set GROQ_API_KEY (or GEMINI_API_KEY) in mathvox-backend/.env for vision OCR"
    )
