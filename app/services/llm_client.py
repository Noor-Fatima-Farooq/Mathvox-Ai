import json
import os
import re

PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower().strip()


def _build_prompt(question: str, answer: str, reply_style: str) -> str:
    if reply_style == "ur_roman":
        language_instruction = (
            "Write the ENTIRE explanation in Roman Urdu (Urdu in Latin script only). "
            "Start with a short, student-friendly preamble (e.g. 'Pehle ... phir ...'). "
            "Keep steps simple and conversational."
        )
    else:
        language_instruction = "Write the explanation in clear English."

    return f"""You are a math tutor. Explain how to solve this problem step by step.

Problem: {question}
The correct final answer (verified by SymPy) is: {answer}
Your explanation MUST agree with this final answer. Use numbered steps in the step text (1., 2., 3., ...).

{language_instruction}

Respond with ONLY valid JSON in this exact shape:
{{"steps": ["step 1 text", "step 2 text", ...]}}

Do not include markdown code fences or any text outside the JSON object."""


def _parse_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def _normalize_steps(data: dict) -> dict:
    steps = data.get("steps", [])
    if isinstance(steps, str):
        steps = [steps]
    elif not isinstance(steps, list):
        steps = [str(steps)]
    return {"steps": steps}


def _generate_groq(prompt: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys"
        )

    from groq import Groq

    client = Groq(api_key=api_key)
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    completion = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    text = completion.choices[0].message.content or ""
    return _normalize_steps(_parse_json_response(text))


def _generate_gemini(prompt: str) -> dict:
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    genai.configure(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    model = genai.GenerativeModel(model_name)
    response = model.generate_content(prompt)
    return _normalize_steps(_parse_json_response(response.text))


def extract_math_expression(question: str) -> str:
    """Use LLM to pull a SymPy-ready expression from natural language."""
    prompt = f"""From this user message, extract ONLY the math to compute (one expression or equation).

User message: {question}

Rules:
- Output JSON only: {{"expression": "..."}}
- Use * for multiply, / for divide, ** for powers
- Examples:
  - "explain how 4*2=8" -> "4*2"
  - "what is five plus three" -> "5+3"
  - "solve for x if 2x+1=5" -> "2*x+1=5"
  - "quadratic x^2+5x+6=0" -> "x**2+5*x+6=0"
- Use ** for powers. No words outside the expression."""

    if PROVIDER == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        from groq import Groq

        client = Groq(api_key=api_key)
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        text = completion.choices[0].message.content or ""
    elif PROVIDER == "gemini":
        import google.generativeai as genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))
        text = model.generate_content(prompt).text
    else:
        raise RuntimeError(f"Unknown LLM_PROVIDER '{PROVIDER}'")

    data = _parse_json_response(text)
    expression = (data.get("expression") or "").strip()
    if not expression:
        raise ValueError("no_expression")
    return expression


def chat_with_history(
    message: str, history: list[dict], reply_style: str = "ur_roman"
) -> str:
    """Conversational reply using prior chat turns as context."""
    from app.services.reply_language import language_instruction, normalize_style

    style = normalize_style(reply_style)
    lang = language_instruction(style)

    system = f"""You are MathVox, a friendly math tutor in a chat app.
{lang}
You understand Roman Urdu, Urdu, and English in the student's messages.
You have full access to the conversation history in this thread — use it as memory.
When the student refers to "it", "that", "woh", "pehle wala", "last one", or "problem 2",
identify which prior question and answer they mean from the history and respond about that.
Answer follow-ups clearly.
If they want step-by-step work on a specific equation from earlier, walk through that equation.
If they ask for a brand-new calculation not yet discussed, show brief work or suggest they press Solve.
Keep replies concise (a few short paragraphs max)."""

    groq_messages = [{"role": "system", "content": system}]
    for turn in history[-16:]:
        role = turn.get("role", "user")
        if role not in ("user", "assistant"):
            role = "assistant" if role in ("bot", "assistant") else "user"
        text = (turn.get("text") or "").strip()
        if text:
            groq_messages.append({"role": role, "content": text[:3000]})
    groq_messages.append({"role": "user", "content": message.strip()})

    if PROVIDER == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        from groq import Groq

        client = Groq(api_key=api_key)
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        completion = client.chat.completions.create(
            model=model,
            messages=groq_messages,
            temperature=0.4,
        )
        return (completion.choices[0].message.content or "").strip()

    if PROVIDER == "gemini":
        import google.generativeai as genai

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))
        parts = [system, "\n\nConversation:"]
        for turn in history[-16:]:
            label = "Student" if turn.get("role") == "user" else "MathVox"
            parts.append(f"{label}: {turn.get('text', '')}")
        parts.append(f"Student: {message.strip()}\nMathVox:")
        response = model.generate_content("\n".join(parts))
        return (response.text or "").strip()

    raise RuntimeError(f"Unknown LLM_PROVIDER '{PROVIDER}'")


def generate_explanation(question: str, answer: str, reply_style: str) -> dict:
    prompt = _build_prompt(question, answer, reply_style)

    if PROVIDER == "groq":
        return _generate_groq(prompt)
    if PROVIDER == "gemini":
        return _generate_gemini(prompt)

    raise RuntimeError(
        f"Unknown LLM_PROVIDER '{PROVIDER}'. Use groq or gemini in .env"
    )
