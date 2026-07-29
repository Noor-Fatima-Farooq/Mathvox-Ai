const GUEST_KEY = "mathvox_chat_guest";

export const NEW_CHAT_EVENT = "mathvox:new-chat";
export const THREAD_SELECT_EVENT = "mathvox:select-thread";
export const THREADS_CHANGED_EVENT = "mathvox:threads-changed";
export const THREAD_DELETED_EVENT = "mathvox:thread-deleted";
export const MAX_PINNED_CHATS = 3;
export const TOGGLE_SIDEBAR_EVENT = "mathvox:toggle-sidebar";
export const SIDEBAR_COLLAPSED_KEY = "mathvox_sidebar_collapsed";

export function isSidebarCollapsed() {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function setSidebarCollapsed(collapsed) {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!!collapsed));
}

export function isLoggedIn() {
  return !!localStorage.getItem("user_id");
}

function threadsKey(uid) {
  return `mathvox_threads_${uid}`;
}

function activeThreadKey(uid) {
  return `mathvox_active_thread_${uid}`;
}

function legacyChatKey(uid) {
  return `mathvox_chat_${uid}`;
}

export function getUserProfile() {
  return {
    name: localStorage.getItem("user_name") || "",
    username: localStorage.getItem("user_username") || "",
    email: localStorage.getItem("user_email") || "",
  };
}

/** Sidebar label: display name only (from profile / signup), never @username. */
export function getSidebarDisplayName(profile) {
  const p = profile || getUserProfile();
  const name = (p.name || "").trim();
  if (name) return name;
  const username = (p.username || "").trim();
  if (username) return username;
  const email = (p.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "User";
}

export function setUserProfile({ name, username, email }) {
  if (name !== undefined) localStorage.setItem("user_name", name || "");
  if (username !== undefined) localStorage.setItem("user_username", username || "");
  if (email) localStorage.setItem("user_email", email);
  window.dispatchEvent(new Event("mathvox:profile-updated"));
}

export function clearUserProfile() {
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_username");
  localStorage.removeItem("user_email");
}

/** Remove leftover guest chat (logged-out users must not keep history on refresh). */
export function purgeGuestSession() {
  localStorage.removeItem(GUEST_KEY);
}

function migrateLegacyIfNeeded(uid) {
  const legacy = localStorage.getItem(legacyChatKey(uid));
  if (!legacy) return;

  try {
    const data = JSON.parse(legacy);
    if (!Array.isArray(data.messages)) {
      localStorage.removeItem(legacyChatKey(uid));
      return;
    }
    const id = `t_${Date.now()}`;
    const thread = {
      id,
      title: suggestChatTitle(data.messages),
      messages: data.messages,
      lastSolved: data.lastSolved || null,
      question: data.question || "",
      updatedAt: data.savedAt || Date.now(),
    };
    localStorage.setItem(threadsKey(uid), JSON.stringify([thread]));
    localStorage.setItem(activeThreadKey(uid), id);
    localStorage.removeItem(legacyChatKey(uid));
  } catch {
    localStorage.removeItem(legacyChatKey(uid));
  }
}

export function suggestChatTitle(messages) {
  const userLines = (messages || [])
    .filter((m) => m.type === "user" && m.text?.trim())
    .map((m) => m.text.trim().replace(/\s+/g, " "));

  if (!userLines.length) return "New chat";

  const sample = userLines.slice(0, 3).join(" · ");
  let title = sample;

  const mathMatch = sample.match(
    /(?:\d+\s*[+\-*/^]\s*\d+|[\d.]+[xXyYzZ]?[\s=]|[\d.]+\s*=\s*[\d.]+)/
  );
  if (mathMatch) {
    const idx = sample.indexOf(mathMatch[0]);
    title = sample.slice(Math.max(0, idx - 8), idx + mathMatch[0].length + 12).trim();
  }

  if (title.length > 52) title = `${title.slice(0, 49)}…`;
  return title || "New chat";
}

function readThreads(uid) {
  migrateLegacyIfNeeded(uid);
  try {
    const raw = localStorage.getItem(threadsKey(uid));
    if (!raw) return [];
    const threads = JSON.parse(raw);
    return Array.isArray(threads) ? threads : [];
  } catch {
    return [];
  }
}

function writeThreads(uid, threads) {
  localStorage.setItem(threadsKey(uid), JSON.stringify(threads));
  window.dispatchEvent(new Event(THREADS_CHANGED_EVENT));
}

function sortThreadsForList(threads) {
  return [...threads].sort((a, b) => {
    const aPin = !!a.pinned;
    const bPin = !!b.pinned;
    if (aPin && !bPin) return -1;
    if (!aPin && bPin) return 1;
    if (aPin && bPin) return (b.pinnedAt || 0) - (a.pinnedAt || 0);
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

export function countPinnedChats() {
  const uid = localStorage.getItem("user_id");
  if (!uid) return 0;
  return readThreads(uid).filter((t) => t.pinned).length;
}

function threadMessageText(thread) {
  return (thread.messages || [])
    .map((m) => m.text || "")
    .join(" ")
    .toLowerCase();
}

export function listChatThreads() {
  const uid = localStorage.getItem("user_id");
  if (!uid) return [];

  const threads = readThreads(uid);
  return sortThreadsForList(threads).map((t) => ({
    id: t.id,
    title: t.title || "New chat",
    updatedAt: t.updatedAt || 0,
    pinned: !!t.pinned,
    preview:
      t.messages?.filter((m) => m.type === "user").pop()?.text?.slice(0, 60) || "",
  }));
}

/** Search chats by title and message content (case-insensitive). */
export function searchChatThreads(query) {
  const uid = localStorage.getItem("user_id");
  if (!uid) return [];

  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const threads = readThreads(uid);
  return sortThreadsForList(
    threads.filter((t) => {
      const title = (t.title || "New chat").toLowerCase();
      if (title.includes(q)) return true;
      return threadMessageText(t).includes(q);
    })
  ).map((t) => {
    const lastUser = t.messages?.filter((m) => m.type === "user").pop()?.text;
    const snippet = (lastUser || "").replace(/\s+/g, " ").trim().slice(0, 72);
    return {
      id: t.id,
      title: t.title || "New chat",
      pinned: !!t.pinned,
      snippet: snippet ? (snippet.length >= 72 ? `${snippet}…` : snippet) : "",
      updatedAt: t.updatedAt || 0,
    };
  });
}

export function renameChatThread(threadId, title) {
  const uid = localStorage.getItem("user_id");
  if (!uid) return { ok: false, error: "Not logged in." };

  const trimmed = String(title || "").trim().slice(0, 80);
  if (!trimmed) return { ok: false, error: "Title cannot be empty." };

  const threads = readThreads(uid);
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx < 0) return { ok: false, error: "Chat not found." };

  threads[idx].title = trimmed;
  threads[idx].customTitle = true;
  threads[idx].updatedAt = threads[idx].updatedAt || Date.now();
  writeThreads(uid, threads);
  return { ok: true };
}

export function setChatPinned(threadId, pinned) {
  const uid = localStorage.getItem("user_id");
  if (!uid) return { ok: false, error: "Not logged in." };

  const threads = readThreads(uid);
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx < 0) return { ok: false, error: "Chat not found." };

  if (pinned) {
    const pinnedCount = threads.filter((t) => t.pinned && t.id !== threadId).length;
    if (pinnedCount >= MAX_PINNED_CHATS) {
      return {
        ok: false,
        error: `You can only pin up to ${MAX_PINNED_CHATS} chats. Unpin one first.`,
      };
    }
    threads[idx].pinned = true;
    threads[idx].pinnedAt = Date.now();
  } else {
    threads[idx].pinned = false;
    delete threads[idx].pinnedAt;
  }

  writeThreads(uid, threads);
  return { ok: true };
}

export function deleteChatThread(threadId) {
  const uid = localStorage.getItem("user_id");
  if (!uid) return { ok: false, error: "Not logged in." };

  const threads = readThreads(uid);
  const filtered = threads.filter((t) => t.id !== threadId);
  if (filtered.length === threads.length) {
    return { ok: false, error: "Chat not found." };
  }

  const wasActive = getActiveThreadId() === threadId;
  writeThreads(uid, filtered);

  if (wasActive) {
    const next = sortThreadsForList(filtered)[0];
    if (next) setActiveThreadId(next.id);
    else createNewThread();
  }

  window.dispatchEvent(
    new CustomEvent(THREAD_DELETED_EVENT, {
      detail: { threadId, wasActive },
    })
  );
  return { ok: true };
}

export function getActiveThreadId() {
  const uid = localStorage.getItem("user_id");
  if (!uid) return null;
  migrateLegacyIfNeeded(uid);
  return localStorage.getItem(activeThreadKey(uid));
}

export function setActiveThreadId(threadId) {
  const uid = localStorage.getItem("user_id");
  if (!uid || !threadId) return;
  localStorage.setItem(activeThreadKey(uid), threadId);
}

export function loadChatSession(threadId = null) {
  if (!isLoggedIn()) {
    purgeGuestSession();
    return null;
  }

  const uid = localStorage.getItem("user_id");
  migrateLegacyIfNeeded(uid);

  try {
    const raw = localStorage.getItem(threadsKey(uid));
    if (!raw) return null;
    const threads = JSON.parse(raw);
    if (!Array.isArray(threads) || !threads.length) return null;

    const activeId = threadId || getActiveThreadId() || threads[0].id;
    const thread = threads.find((t) => t.id === activeId) || threads[0];
    setActiveThreadId(thread.id);

    if (!Array.isArray(thread.messages)) return null;

    return {
      threadId: thread.id,
      title: thread.title,
      messages: thread.messages,
      lastSolved: thread.lastSolved || null,
      question: thread.question || "",
    };
  } catch {
    return null;
  }
}

export function saveChatSession({ threadId, messages, lastSolved, question, title }) {
  if (!isLoggedIn()) return;

  const uid = localStorage.getItem("user_id");
  if (!uid) return;

  let id = threadId || getActiveThreadId();
  if (!id) {
    id = createNewThread();
  }

  const nextTitle =
    title || suggestChatTitle(messages) || "New chat";

  let threads = [];
  try {
    const raw = localStorage.getItem(threadsKey(uid));
    if (raw) threads = JSON.parse(raw);
    if (!Array.isArray(threads)) threads = [];
  } catch {
    threads = [];
  }

  const payload = {
    messages: (messages || []).map((m) => ({
      type: m.type,
      text: m.text,
      viaVoice: !!m.viaVoice,
    })),
    lastSolved: lastSolved || null,
    question: question || "",
    updatedAt: Date.now(),
  };

  const idx = threads.findIndex((t) => t.id === id);
  if (idx >= 0) {
    const prev = threads[idx];
    const autoTitle = messages?.length ? nextTitle : prev.title || "New chat";
    threads[idx] = {
      ...prev,
      ...payload,
      id,
      pinned: !!prev.pinned,
      pinnedAt: prev.pinnedAt,
      customTitle: !!prev.customTitle,
      title: prev.customTitle ? prev.title || "New chat" : autoTitle,
    };
  } else {
    threads.unshift({
      id,
      title: nextTitle,
      ...payload,
    });
  }

  writeThreads(uid, threads);
  setActiveThreadId(id);
}

export function createNewThread() {
  const uid = localStorage.getItem("user_id");
  if (!uid) return null;

  const id = `t_${Date.now()}`;
  const thread = {
    id,
    title: "New chat",
    messages: [],
    lastSolved: null,
    question: "",
    updatedAt: Date.now(),
  };

  let threads = [];
  try {
    const raw = localStorage.getItem(threadsKey(uid));
    if (raw) {
      threads = JSON.parse(raw);
      if (!Array.isArray(threads)) threads = [];
    }
  } catch {
    threads = [];
  }

  threads.unshift(thread);
  writeThreads(uid, threads);
  setActiveThreadId(id);
  return id;
}

export function onLogout() {
  purgeGuestSession();
  clearUserProfile();
}

export function usesServerChats() {
  return isLoggedIn();
}

async function threadApi() {
  return import("./api");
}

export async function fetchChatThreads() {
  if (!isLoggedIn()) return listChatThreads();
  const { listThreadsApi } = await threadApi();
  const data = await listThreadsApi();
  return (data.threads || []).map((t) => ({
    id: String(t.id),
    title: t.title || "New chat",
    updatedAt: t.updatedAt || 0,
    pinned: !!t.pinned,
    preview: t.preview || "",
  }));
}

export async function ensureServerThread() {
  if (!isLoggedIn()) return null;
  const { listThreadsApi, createThreadApi } = await threadApi();
  const data = await listThreadsApi();
  const threads = data.threads || [];
  let id = getActiveThreadId();
  if (!threads.length) {
    const created = await createThreadApi();
    id = String(created.id);
    setActiveThreadId(id);
    return id;
  }
  if (!id || !threads.some((t) => String(t.id) === String(id))) {
    id = String(threads[0].id);
    setActiveThreadId(id);
  }
  return id;
}

export async function loadThreadFromServer(threadId) {
  const { getThreadApi } = await threadApi();
  const data = await getThreadApi(Number(threadId));
  return {
    threadId: String(data.id),
    title: data.title,
    messages: data.messages || [],
    lastSolved: data.lastSolved || null,
    question: "",
  };
}

export async function createNewThreadServer() {
  const { createThreadApi } = await threadApi();
  const created = await createThreadApi();
  const id = String(created.id);
  setActiveThreadId(id);
  window.dispatchEvent(new Event(THREADS_CHANGED_EVENT));
  return id;
}

export async function renameChatThreadServer(threadId, title) {
  const { patchThreadApi } = await threadApi();
  await patchThreadApi(Number(threadId), { title });
  window.dispatchEvent(new Event(THREADS_CHANGED_EVENT));
  return { ok: true };
}

export async function setChatPinnedServer(threadId, pinned) {
  const { patchThreadApi } = await threadApi();
  try {
    await patchThreadApi(Number(threadId), { pinned });
    window.dispatchEvent(new Event(THREADS_CHANGED_EVENT));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function deleteChatThreadServer(threadId) {
  const { deleteThreadApi } = await threadApi();
  await deleteThreadApi(Number(threadId));
  const wasActive = getActiveThreadId() === String(threadId);
  if (wasActive) {
    const threads = await fetchChatThreads();
    if (threads[0]) setActiveThreadId(threads[0].id);
    else await createNewThreadServer();
  }
  window.dispatchEvent(
    new CustomEvent(THREAD_DELETED_EVENT, {
      detail: { threadId, wasActive },
    })
  );
  window.dispatchEvent(new Event(THREADS_CHANGED_EVENT));
  return { ok: true };
}
