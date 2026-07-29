import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { syncUserProfileFromServer } from "../services/api";
import {
  createNewThread,
  deleteChatThread,
  getSidebarDisplayName,
  getUserProfile,
  listChatThreads,
  MAX_PINNED_CHATS,
  onLogout,
  renameChatThread,
  renameChatThreadServer,
  searchChatThreads,
  setChatPinned,
  setChatPinnedServer,
  deleteChatThreadServer,
  fetchChatThreads,
  createNewThreadServer,
  usesServerChats,
  NEW_CHAT_EVENT,
  THREAD_SELECT_EVENT,
  THREADS_CHANGED_EVENT,
} from "../services/chatStorage";
import ProfileNameModal from "./ProfileNameModal";
import { PinIcon, SearchIcon } from "./icons";

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] || "?").toUpperCase();
}

function ChatThreadMenu({ thread, pinnedCount, onAction }) {
  const canPin = thread.pinned || pinnedCount < MAX_PINNED_CHATS;

  return (
    <div
      className="absolute right-0 top-full mt-1 z-[60] min-w-[168px] py-1 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5"
        onClick={() => onAction("rename")}
      >
        <span className="w-4 text-center opacity-70">✎</span> Rename
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canPin && !thread.pinned}
        title={!canPin ? `Maximum ${MAX_PINNED_CHATS} pinned chats` : undefined}
        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => onAction(thread.pinned ? "unpin" : "pin")}
      >
        <PinIcon className="w-4 h-4 shrink-0 opacity-70" />
        {thread.pinned ? "Unpin chat" : "Pin chat"}
      </button>
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 flex items-center gap-2.5"
        onClick={() => onAction("delete")}
      >
        <span className="w-4 text-center">🗑</span> Delete
      </button>
    </div>
  );
}

function ChatSearchPanel({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const results = query.trim() ? searchChatThreads(query) : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200/70 dark:bg-slate-800">
          <SearchIcon className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-gray-400 hover:text-gray-600 text-sm"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0"
        >
          Cancel
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {!query.trim() ? (
          <p className="px-3 py-2 text-sm text-gray-400">Type to search your chats</p>
        ) : results.length === 0 ? (
          <p className="px-3 py-2 text-sm text-gray-400">No chats found</p>
        ) : (
          <ul className="space-y-0.5">
            {results.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-gray-200/70 dark:hover:bg-slate-800"
                >
                  <span className="block truncate font-medium text-gray-800 dark:text-gray-200">
                    {t.title}
                  </span>
                  {t.snippet && (
                    <span className="block truncate text-xs text-gray-500 mt-0.5">
                      {t.snippet}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChatThreadRow({ thread, active, pinnedCount, onSelect, onToast }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const handleMenuAction = async (action) => {
    setMenuOpen(false);

    if (action === "rename") {
      const next = window.prompt("Rename chat", thread.title || "New chat");
      if (next == null) return;
      if (usesServerChats()) {
        renameChatThreadServer(thread.id, next).catch((e) => window.alert(e.message));
      } else {
        const res = renameChatThread(thread.id, next);
        if (!res.ok) window.alert(res.error);
      }
      return;
    }

    if (action === "pin") {
      if (usesServerChats()) {
        const res = await setChatPinnedServer(thread.id, true);
        if (!res.ok) onToast?.(res.error);
      } else {
        const res = setChatPinned(thread.id, true);
        if (!res.ok) onToast?.(res.error);
      }
      return;
    }

    if (action === "unpin") {
      if (usesServerChats()) {
        await setChatPinnedServer(thread.id, false);
      } else {
        setChatPinned(thread.id, false);
      }
      return;
    }

    if (action === "delete") {
      const ok = window.confirm("Delete this chat? This cannot be undone.");
      if (!ok) return;
      if (usesServerChats()) {
        deleteChatThreadServer(thread.id).catch((e) => window.alert(e.message));
      } else {
        const res = deleteChatThread(thread.id);
        if (!res.ok) window.alert(res.error);
      }
    }
  };

  return (
    <li ref={rowRef} className="relative group">
      <div className="flex items-center gap-0.5 rounded-lg hover:bg-gray-200/70 dark:hover:bg-slate-800/80">
        <button
          type="button"
          onClick={() => onSelect(thread.id)}
          title={thread.title}
          className={`flex-1 min-w-0 text-left px-3 py-2.5 text-sm truncate transition-colors flex items-center gap-1 ${
            active
              ? "bg-gray-200 dark:bg-slate-800 text-gray-900 dark:text-white font-medium rounded-lg"
              : "text-gray-700 dark:text-gray-300"
          }`}
        >
          <span className="truncate flex-1">{thread.title || "New chat"}</span>
          {thread.pinned && (
            <PinIcon className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className={`shrink-0 w-8 h-8 mr-1 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-300/60 dark:hover:bg-slate-700 ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          aria-label="Chat options"
        >
          ⋯
        </button>
      </div>
      {menuOpen && (
        <ChatThreadMenu
          thread={thread}
          pinnedCount={pinnedCount}
          onAction={handleMenuAction}
        />
      )}
    </li>
  );
}

export default function ChatSidebar({
  isOpen,
  setIsOpen,
  collapsed,
  activeThreadId,
  onNewChat,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const userId = localStorage.getItem("user_id");
  const [profile, setProfile] = useState(() => getUserProfile());
  const [threads, setThreads] = useState([]);
  const [toast, setToast] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const refresh = useCallback(async () => {
    if (usesServerChats()) {
      try {
        setThreads(await fetchChatThreads());
      } catch {
        setThreads(listChatThreads());
      }
    } else {
      setThreads(listChatThreads());
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(THREADS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(THREADS_CHANGED_EVENT, refresh);
  }, [refresh, activeThreadId]);

  useEffect(() => {
    syncUserProfileFromServer()
      .then(() => setProfile(getUserProfile()))
      .catch(() => setProfile(getUserProfile()));
  }, []);

  useEffect(() => {
    const onProfile = () => setProfile(getUserProfile());
    window.addEventListener("mathvox:profile-updated", onProfile);
    return () => window.removeEventListener("mathvox:profile-updated", onProfile);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const pinnedCount = threads.filter((t) => t.pinned).length;
  const displayName = getSidebarDisplayName(profile);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDoc = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileMenuOpen]);

  const handleNewChat = async () => {
    if (usesServerChats()) {
      await createNewThreadServer();
    } else {
      createNewThread();
    }
    window.dispatchEvent(new Event(NEW_CHAT_EVENT));
    onNewChat?.();
    setIsOpen(false);
    if (location.pathname !== "/chat") navigate("/chat");
    refresh();
  };

  const handleSelect = (id) => {
    window.dispatchEvent(
      new CustomEvent(THREAD_SELECT_EVENT, { detail: { threadId: id } })
    );
    setIsOpen(false);
    if (location.pathname !== "/chat") navigate("/chat");
  };

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    onLogout();
    setIsOpen(false);
    window.location.href = "/chat";
  };

  if (!userId) return null;

  return (
    <>
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50
          h-dvh w-[260px] shrink-0
          bg-[#f9f9f9] dark:bg-slate-950
          border-r border-gray-200 dark:border-slate-800
          flex flex-col
          transition-transform duration-200 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "md:-translate-x-full" : "md:translate-x-0"}
        `}
      >
        <div className="flex items-center justify-between p-3 border-b border-gray-200/80 dark:border-slate-800 md:hidden">
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            Math<span className="text-[#5d44f8]">Vox</span>
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-white px-2"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="p-2">
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              handleNewChat();
            }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-200/80 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            New chat
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-200/80 dark:hover:bg-slate-800 transition-colors mt-0.5"
          >
            <SearchIcon className="w-4 h-4 opacity-70" />
            Search chats
          </button>
        </div>

        {searchOpen ? (
          <ChatSearchPanel
            onSelect={(id) => {
              handleSelect(id);
              setSearchOpen(false);
            }}
            onClose={() => setSearchOpen(false)}
          />
        ) : (
        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
          <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Chats
            {pinnedCount > 0 && (
              <span className="normal-case font-normal text-gray-400">
                {" "}
                · {pinnedCount}/{MAX_PINNED_CHATS} pinned
              </span>
            )}
          </p>
          {threads.length === 0 ? (
            <p className="px-3 text-sm text-gray-400">No chats yet</p>
          ) : (
            <ul className="space-y-0.5">
              {threads.map((t) => (
                <ChatThreadRow
                  key={t.id}
                  thread={t}
                  active={t.id === activeThreadId}
                  pinnedCount={pinnedCount}
                  onSelect={handleSelect}
                  onToast={setToast}
                />
              ))}
            </ul>
          )}
        </div>
        )}

        {toast && (
          <p className="mx-3 mb-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1.5 rounded-lg">
            {toast}
          </p>
        )}

        <div className="p-2 border-t border-gray-200 dark:border-slate-800 space-y-1">
          <Link
            to="/skills"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-slate-800"
          >
            My level
          </Link>
          <Link
            to="/progress"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-slate-800"
          >
            Progress
          </Link>
        </div>

        <div
          className="p-3 border-t border-gray-200 dark:border-slate-800 mt-auto relative"
          ref={profileMenuRef}
        >
          <button
            type="button"
            onClick={() => setProfileMenuOpen((v) => !v)}
            className="w-full flex items-center gap-3 mb-2 px-1 py-2 rounded-lg hover:bg-gray-200/80 dark:hover:bg-slate-800 text-left"
            title="Account menu"
          >
            <div className="w-9 h-9 rounded-full bg-[#5d44f8] text-white flex items-center justify-center text-sm font-semibold shrink-0">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
            </div>
          </button>

          {profileMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 py-1 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-[60]">
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setProfileEditOpen(true);
                }}
              >
                Profile
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            Log out
          </button>
        </div>

        <ProfileNameModal
          open={profileEditOpen}
          currentName={profile.name}
          currentUsername={profile.username}
          email={profile.email}
          onClose={() => setProfileEditOpen(false)}
          onSaved={() => setProfile(getUserProfile())}
        />
      </aside>
    </>
  );
}
