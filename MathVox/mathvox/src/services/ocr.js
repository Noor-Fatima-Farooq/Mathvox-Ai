import { createWorker } from "tesseract.js";
import { ocrImage } from "./api";
import {
  extractSimpleExpressions,
  getProblemForSolve,
  isSingleProblem,
  isWorksheetBatch,
  isWorksheetLike,
  scanAdditionPairs,
} from "./problemParse";

export { getProblemForSolve, isSingleProblem, countProblemsForLabel } from "./problemParse";

function fixDigitLookalikes(text) {
  return text
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Zz]/g, "2")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8");
}

function extractVerticalPairs(lines) {
  const exprs = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const top = lines[i].match(/^(\d+)$/);
    const plus = lines[i + 1].match(/^\+?\s*(\d+)\s*$/);
    if (top && plus) {
      exprs.push(`${top[1]}+${plus[1]}`);
      i += 1;
    }
  }
  return exprs;
}

/** Parse math from raw OCR text only (browser fallback) */
export function extractMathExpressions(rawText) {
  const fixed = fixDigitLookalikes(rawText || "");
  const found = new Set();

  for (const m of fixed.matchAll(/(\d+)\s*([+\-*/])\s*(\d+)/g)) {
    const expr = `${m[1]}${m[2]}${m[3]}`.replace(/\s+/g, "");
    if (/^\d+[+\-*/]\d+$/.test(expr)) found.add(expr);
  }

  const lines = fixed
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  extractVerticalPairs(lines).forEach((e) => found.add(e));

  return [...found];
}

export function getAllQuestions(text) {
  if (isSingleProblem(text)) return [];
  const exprs = extractSimpleExpressions(text);
  if (isWorksheetBatch(text, exprs)) return exprs;
  return exprs;
}

export function pickFirstSolvable(text) {
  return getProblemForSolve(text);
}

function buildDisplayFromExpressions(expressions) {
  return (expressions || []).filter(Boolean).join("\n");
}

async function runTesseract(worker, source, params = {}) {
  await worker.setParameters({ tessedit_pageseg_mode: "3", ...params });
  const { data } = await worker.recognize(source);
  return { text: data.text || "", confidence: data.confidence || 0 };
}

/** Upscale image in browser before Tesseract (helps blurry worksheets) */
function preprocessImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(3, Math.max(2, 1600 / Math.max(img.width, img.height)));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.filter = "contrast(1.35) brightness(1.05)";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Preprocess failed"))),
        "image/png",
        1
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

async function recognizeWithTesseract(file, onProgress) {
  let source = file;
  try {
    source = await preprocessImageFile(file);
  } catch {
    source = file;
  }

  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });

  const passes = [
    { params: { tessedit_pageseg_mode: "3" } },
    { params: { tessedit_pageseg_mode: "6" } },
    { params: { tessedit_pageseg_mode: "11" } },
  ];

  let best = { raw: "", confidence: -1, expressions: [] };

  try {
    for (let i = 0; i < passes.length; i++) {
      if (onProgress) onProgress(Math.round(((i + 1) / passes.length) * 100));

      const { text, confidence } = await runTesseract(worker, source, passes[i].params);
      const expressions = extractMathExpressions(text);
      const score =
        expressions.length * 100 + confidence + Math.min(text.length, 200);

      if (score > best.confidence + best.expressions.length * 100) {
        best = { raw: text, confidence, expressions };
      }
    }

    const display = buildDisplayFromExpressions(best.expressions);
    if (!display && !best.raw.trim()) {
      throw new Error(
        "Could not read this image. Add GROQ_API_KEY in mathvox-backend/.env and restart the backend."
      );
    }

    return {
      text: display || best.raw.trim().slice(0, 4000),
      expressions: best.expressions,
      raw_text: best.raw,
      confidence: best.confidence,
    };
  } finally {
    await worker.terminate();
  }
}

function mergeOcrResponse(data) {
  const raw = (data.raw_text || data.text || "").trim();
  const fromVision = Array.isArray(data.expressions) && data.expressions.length > 0;

  if (isSingleProblem(raw)) {
    return { text: raw, expressions: [], raw_text: raw };
  }

  let expressions = fromVision
    ? data.expressions.map((e) => String(e).replace(/\s+/g, ""))
    : extractSimpleExpressions(raw);

  if (isWorksheetLike(raw)) {
    const pairs = scanAdditionPairs(raw, { singleDigitOnly: true });
    if (pairs.length >= expressions.length) {
      expressions = pairs;
    }
  }

  const text = isWorksheetBatch(raw, expressions)
    ? expressions.join("\n")
    : raw || expressions.join("\n");

  return {
    text,
    expressions,
    raw_text: raw,
  };
}

export async function recognizeMathImage(file, onProgress) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }

  if (onProgress) onProgress(5);

  let backendError = null;

  try {
    const data = await ocrImage(file);
    const merged = mergeOcrResponse(data);
    if (merged.expressions?.length || merged.text?.trim()) {
      if (onProgress) onProgress(100);
      return {
        ...merged,
        confidence: 95,
        source: data.source || "vision",
        problem_count: data.problem_count || merged.expressions?.length || 0,
      };
    }
    backendError = "Vision OCR returned no problems";
  } catch (err) {
    backendError =
      err.message ||
      "Groq vision OCR unavailable — check GROQ_API_KEY and restart uvicorn on port 8080";
  }

  if (onProgress) onProgress(15);

  const result = await recognizeWithTesseract(file, onProgress);
  result.source = "tesseract";
  if (backendError) {
    result.hint = backendError;
  }
  if (!result.expressions?.length && result.raw_text) {
    const parsed = extractSimpleExpressions(result.raw_text);
    if (parsed.length) {
      result.expressions = parsed;
      result.text = parsed.join("\n");
    }
  }
  return result;
}
