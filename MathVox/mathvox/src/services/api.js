import { setUserProfile } from "./chatStorage";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080";

/** Load name & email from database for the logged-in user. */
export const syncUserProfileFromServer = async () => {
  const user_id = localStorage.getItem("user_id");
  if (!user_id) return null;

  const res = await fetch(`${BASE_URL}/auth/me?user_id=${user_id}`);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.name !== undefined || data.username !== undefined || data.email) {
    setUserProfile({
      name: data.name || "",
      username: data.username || "",
      email: data.email,
    });
  }
  return data;
};

export const updateUserProfile = async ({ name, username }) => {
  const user_id = localStorage.getItem("user_id");
  if (!user_id) throw new Error("Not logged in.");

  const payload = { user_id: Number(user_id) };
  if (name !== undefined) payload.name = name;
  if (username !== undefined) payload.username = username;

  const res = await fetch(`${BASE_URL}/auth/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Could not update profile"
    );
  }
  setUserProfile({
    name: data.name || "",
    username: data.username || "",
    email: data.email,
  });
  return data;
};

/** @deprecated use updateUserProfile */
export const updateUserName = async (name) => updateUserProfile({ name });

// ✅ VISION OCR (Gemini / Groq on backend; falls back to browser Tesseract in ocr.js)
export const ocrImage = async (file) => {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/ocr`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "OCR request failed");
  }

  return res.json();
};

/** Format single or multi-question solve response for chat */
export function formatSolveResponse(data) {
  if (data?.error) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not solve"
    );
  }
  if (data?.answer) return data.answer;
  if (data?.results?.length) {
    return data.results
      .map((row, i) => {
        if (row.error) return `${i + 1}. ${row.question} → ${row.error}`;
        return `${i + 1}. ${row.question} = ${row.answer}`;
      })
      .join("\n");
  }
  throw new Error("No solution returned");
}

// ✅ SOLVE (one or many problems)
export const solveQuestion = async (question) => {
  const user_id = localStorage.getItem("user_id");

  const res = await fetch(`${BASE_URL}/solve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question: question,
      user_id: user_id ? Number(user_id) : null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: err.detail || err.error || "Solve request failed" };
  }

  return res.json();
};

// ✅ CHAT with conversation context (follow-ups, discussion)
export const chatWithContext = async (
  message,
  history = [],
  replyStyle = "ur_roman"
) => {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, reply_style: replyStyle }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    throw new Error(
      typeof detail === "string" ? detail : "Chat request failed"
    );
  }

  return res.json();
};

// ✅ EXPLAIN (step-by-step)
export const explainSteps = async (question, replyStyle = "ur_roman", answer = null) => {
  const body = {
    question,
    reply_style: replyStyle,
  };

  if (answer) {
    body.answer = answer;
  }

  const res = await fetch(`${BASE_URL}/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : detail || "Explain request failed";
    throw new Error(message);
  }

  return res.json();
};

// --- Chat threads (database) ---
function requireUserId() {
  const user_id = localStorage.getItem("user_id");
  if (!user_id) throw new Error("Not logged in.");
  return Number(user_id);
}

export const listThreadsApi = async () => {
  const user_id = requireUserId();
  const res = await fetch(`${BASE_URL}/threads?user_id=${user_id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not load chats");
  }
  return res.json();
};

export const createThreadApi = async (title = "New chat") => {
  const res = await fetch(`${BASE_URL}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: requireUserId(), title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not create chat");
  }
  return res.json();
};

export const getThreadApi = async (threadId) => {
  const user_id = requireUserId();
  const res = await fetch(`${BASE_URL}/threads/${threadId}?user_id=${user_id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not load chat");
  }
  return res.json();
};

export const patchThreadApi = async (threadId, { title, pinned }) => {
  const res = await fetch(`${BASE_URL}/threads/${threadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: requireUserId(),
      title,
      pinned,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not update chat");
  }
  return res.json();
};

export const deleteThreadApi = async (threadId) => {
  const user_id = requireUserId();
  const res = await fetch(`${BASE_URL}/threads/${threadId}?user_id=${user_id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not delete chat");
  }
  return res.json();
};

/** Smart tutor: LLM routes solve / explain / discuss with full thread memory */
export const askTutor = async (threadId, message, replyStyle = "ur_roman") => {
  const res = await fetch(`${BASE_URL}/tutor/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: requireUserId(),
      thread_id: Number(threadId),
      message,
      reply_style: replyStyle,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Tutor request failed"
    );
  }
  return data;
};

export const getProgressApi = async () => {
  const user_id = requireUserId();
  const res = await fetch(`${BASE_URL}/progress?user_id=${user_id}`);
  if (!res.ok) return null;
  return res.json();
};

export const getProgressActivity = async () => {
  const user_id = requireUserId();
  const res = await fetch(`${BASE_URL}/progress/activity?user_id=${user_id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not load progress");
  }
  return res.json();
};

// --- Skill assessment ---
export const getAssessmentTopics = async () => {
  const res = await fetch(`${BASE_URL}/assessment/topics`);
  if (!res.ok) {
    throw new Error("Could not load topics");
  }
  const data = await res.json();
  return data.topics || [];
};

export const getSkillProfile = async () => {
  const user_id = requireUserId();
  const res = await fetch(`${BASE_URL}/skills/profile?user_id=${user_id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not load skills");
  }
  return res.json();
};

export const startAssessment = async (topic = null) => {
  const user_id = requireUserId();
  const res = await fetch(`${BASE_URL}/assessment/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: Number(user_id), topic }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Could not start assessment"
    );
  }
  return data;
};

export const submitAssessmentAnswer = async (sessionId, answer, timeTakenSeconds) => {
  const user_id = requireUserId();
  const res = await fetch(`${BASE_URL}/assessment/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: Number(user_id),
      session_id: sessionId,
      answer,
      time_taken_seconds: timeTakenSeconds ?? null,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Could not submit answer"
    );
  }
  return data;
};

export const getTopicSkillDetail = async (topic) => {
  const user_id = requireUserId();
  const res = await fetch(
    `${BASE_URL}/skills/topic/${encodeURIComponent(topic)}?user_id=${user_id}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Could not load topic");
  }
  return data;
};

export const signupUser = async ({
  username,
  name,
  email,
  password,
  confirmPassword,
}) => {
  const res = await fetch(`${BASE_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      name: name || undefined,
      email,
      password,
      confirm_password: confirmPassword,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : data.error || "Signup failed"
    );
  }
  return data;
};

export const verifyEmail = async (token) => {
  const res = await fetch(`${BASE_URL}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Verification failed"
    );
  }
  return data;
};

export const forgotPassword = async (email) => {
  const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Request failed"
    );
  }
  return data;
};

export const resetPassword = async (token, password, confirmPassword) => {
  const res = await fetch(`${BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      password,
      confirm_password: confirmPassword,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Reset failed"
    );
  }
  return data;
};

export const resendVerification = async (email) => {
  const res = await fetch(`${BASE_URL}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Could not resend email"
    );
  }
  return data;
};

// ✅ LOGIN USER
export const loginUser = async (email, password) => {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  return res.json();
};
