/** Shared logic: one whole problem vs worksheet batch (mirrors backend). */

const SIMPLE_ADD = /^\d{1,2}[+\-]\d{1,2}$/;
const SINGLE_DIGIT_ADD = /^\d\+\d$/;

const WORKSHEET_HINT =
  /single\s*digit|digit\s*addition|worksheet|sheet\s*\d|solve\s+the\s+problems|education\.com|suncatcher/i;

const ADD_PAIR = /(\d{1,2})\s*\+\s*(\d{1,2})/g;

export function isWorksheetLike(text) {
  return WORKSHEET_HINT.test(text || "");
}

export function scanAdditionPairs(rawText, { singleDigitOnly = false } = {}) {
  const fixed = (rawText || "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1");
  const found = [];
  const seen = new Set();
  let m;
  const re = new RegExp(ADD_PAIR.source, "g");
  while ((m = re.exec(fixed)) !== null) {
    const expr = `${m[1]}+${m[2]}`.replace(/\s+/g, "");
    if (singleDigitOnly && !SINGLE_DIGIT_ADD.test(expr)) continue;
    if (!seen.has(expr)) {
      seen.add(expr);
      found.push(expr);
    }
  }
  return found;
}

export function isSingleProblem(text) {
  const t = (text || "").trim();
  if (!t) return true;

  if (isWorksheetLike(t)) {
    const pairs = scanAdditionPairs(t, { singleDigitOnly: true });
    if (pairs.length >= 2) return false;
  }

  const lower = t.toLowerCase();
  if (
    /\b(solve|find|calculate|evaluate|simplify|factor|expand|what is|value of)\b/i.test(
      lower
    )
  ) {
    if (/solve\s+the\s+problems/i.test(lower) && isWorksheetLike(t)) {
      /* worksheet instructions, not one word problem */
    } else {
      return true;
    }
  }
  if (/[xyzXYZ]/.test(t)) return true;
  if (/[\^]|sqrt|\(|\)|\*\*/i.test(t)) return true;

  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    const compact = lines[0]?.replace(/\s+/g, "") || t.replace(/\s+/g, "");
    const ops = (compact.match(/[+\-*/]/g) || []).length;
    if (ops >= 2 && !/^(\d{1,2}[+\-]\d{1,2})+$/.test(compact)) return true;
    if (compact.includes("=") && compact.length > 12) return true;
  } else if (lines.some((l) => /[xyzXYZ=^*()]/.test(l))) {
    return true;
  }

  return false;
}

export function extractSimpleExpressions(rawText) {
  if (isWorksheetLike(rawText)) {
    const pairs = scanAdditionPairs(rawText, { singleDigitOnly: true });
    if (pairs.length >= 2) return pairs;
  }

  if (isSingleProblem(rawText)) return [];

  const found = new Set();
  const fixed = rawText || "";

  for (const m of fixed.matchAll(/(\d+)\s*([+\-*/])\s*(\d+)/g)) {
    const expr = `${m[1]}${m[2]}${m[3]}`.replace(/\s+/g, "");
    if (SIMPLE_ADD.test(expr)) found.add(expr);
  }

  scanAdditionPairs(fixed).forEach((e) => {
    if (SIMPLE_ADD.test(e)) found.add(e);
  });

  const lines = fixed.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    const top = lines[i].match(/^(\d+)$/);
    const plus = lines[i + 1].match(/^\+?\s*(\d+)$/);
    if (top && plus) {
      found.add(`${top[1]}+${plus[1]}`);
      i += 1;
    }
  }

  return [...found];
}

export function isWorksheetBatch(text, exprs) {
  if (!exprs?.length || exprs.length < 2) return false;
  if (isSingleProblem(text)) return false;
  if (isWorksheetLike(text) && exprs.length >= 2) return true;
  return exprs.every((e) => SIMPLE_ADD.test(e.replace(/\s+/g, "")));
}

/** What to send to POST /solve — always one string. */
export function getProblemForSolve(text) {
  const t = (text || "").trim();
  if (!t) return "";

  if (isSingleProblem(t)) return t;

  const exprs = extractSimpleExpressions(t);
  if (isWorksheetBatch(t, exprs)) return exprs.join("\n");

  if (exprs.length === 1) return exprs[0];

  return t;
}

export function countProblemsForLabel(text) {
  if (isSingleProblem(text)) return 0;
  const exprs = extractSimpleExpressions(text);
  if (isWorksheetBatch(text, exprs)) return exprs.length;
  return 0;
}
