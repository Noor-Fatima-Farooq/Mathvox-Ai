/** User reply language: Roman Urdu (default) or English */

export const REPLY_STYLE_KEY = "mathvox_reply_style";
export const REPLY_STYLE_EVENT = "mathvox:reply-style-changed";

const ENGLISH_EXPLICIT =
  /\b(in english|english please|answer in english|explain in english|speak english|use english|reply in english|write in english|only english)\b/i;

const URDU_EXPLICIT =
  /\b(roman urdu|urdu mein|roman urdu mein|urdu me|hindi urdu)\b/i;

export function normalizeReplyStyle(style) {
  return style === "en" ? "en" : "ur_roman";
}

export function getReplyStylePreference() {
  const stored = localStorage.getItem(REPLY_STYLE_KEY);
  return normalizeReplyStyle(stored || "ur_roman");
}

export function setReplyStylePreference(style) {
  const next = normalizeReplyStyle(style);
  localStorage.setItem(REPLY_STYLE_KEY, next);
  window.dispatchEvent(
    new CustomEvent(REPLY_STYLE_EVENT, { detail: { style: next } })
  );
  return next;
}

/** Per-message style: explicit phrase overrides button preference */
export function resolveReplyStyleForMessage(message) {
  const pref = getReplyStylePreference();
  const msg = message || "";

  if (ENGLISH_EXPLICIT.test(msg)) {
    setReplyStylePreference("en");
    return "en";
  }
  if (URDU_EXPLICIT.test(msg)) {
    setReplyStylePreference("ur_roman");
    return "ur_roman";
  }
  return pref;
}

export function applyPreferenceUpdate(preferenceUpdate) {
  if (preferenceUpdate === "en" || preferenceUpdate === "ur_roman") {
    setReplyStylePreference(preferenceUpdate);
  }
}

/** Guest /solve formatting — mirrors backend format_solve_reply */
export function formatSolveForStyle(data, style = "ur_roman") {
  if (data?.error) {
    const err = typeof data.error === "string" ? data.error : "Could not solve";
    return style === "en" ? `Could not solve: ${err}` : `Hal nahi mil saka: ${err}`;
  }
  if (data?.results?.length) {
    return data.results
      .map((row, i) => {
        const n = i + 1;
        if (row.error) {
          return style === "en"
            ? `${n}. ${row.question} → ${row.error}`
            : `${n}. ${row.question} → masla: ${row.error}`;
        }
        return style === "en"
          ? `${n}. ${row.question} = ${row.answer}`
          : `${n}. ${row.question} ka jawab = ${row.answer}`;
      })
      .join("\n");
  }
  if (data?.answer) {
    const q = data.question || "";
    if (style === "en") return q ? `${q} = ${data.answer}` : String(data.answer);
    return q ? `${q} ka jawab = ${data.answer}` : `Jawab: ${data.answer}`;
  }
  return style === "en" ? "No solution returned." : "Koi jawab nahi mila.";
}
