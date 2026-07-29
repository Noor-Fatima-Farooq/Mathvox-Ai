import re

EXPR_RE = re.compile(r"^(\d+)\s*([+\-*/])\s*(\d+)$")


def expr_supported_in_raw(expr: str, raw: str) -> bool:
    """Reject hallucinated pairs not grounded in OCR raw text."""
    if not raw or not expr:
        return False

    m = EXPR_RE.match(expr.replace(" ", ""))
    if not m:
        return True

    a, op, b = m.group(1), m.group(2), m.group(3)
    if op != "+":
        return bool(
            re.search(
                rf"{re.escape(a)}\s*{re.escape(op)}\s*{re.escape(b)}", raw
            )
        )

    patterns = [
        rf"{re.escape(a)}\s*\+\s*{re.escape(b)}",
        rf"{re.escape(a)}\s*\n\s*\+\s*{re.escape(b)}",
        rf"\b{re.escape(a)}\b[^\d]{{0,30}}\+[^\d]{{0,5}}\b{re.escape(b)}\b",
    ]
    for pat in patterns:
        if re.search(pat, raw, re.IGNORECASE | re.MULTILINE):
            return True

    for match in re.finditer(rf"\b{re.escape(a)}\b", raw):
        chunk = raw[match.start() : match.start() + 120]
        if re.search(rf"\+[\s]*{re.escape(b)}\b", chunk):
            return True

    return False


def dedupe_expressions(expressions: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for expr in expressions:
        clean = re.sub(r"\s+", "", (expr or "").strip()).replace("?", "")
        if not EXPR_RE.match(clean) or clean in seen:
            continue
        seen.add(clean)
        out.append(clean)
    return out


def filter_valid_expressions(expressions: list[str], raw: str) -> list[str]:
    if not expressions:
        return []

    seen: set[str] = set()
    out: list[str] = []

    for expr in expressions:
        clean = re.sub(r"\s+", "", (expr or "").strip()).replace("?", "")
        if not EXPR_RE.match(clean):
            continue
        if clean in seen:
            continue
        if expr_supported_in_raw(clean, raw):
            seen.add(clean)
            out.append(clean)

    return out


def filter_single_digit_addition(exprs: list[str]) -> list[str]:
    out = []
    for e in exprs:
        m = EXPR_RE.match(e.replace(" ", ""))
        if m and len(m.group(1)) == 1 and len(m.group(2)) == 1:
            out.append(f"{m.group(1)}+{m.group(2)}")
    return out
