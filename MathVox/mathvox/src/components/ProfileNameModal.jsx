import { useEffect, useRef, useState } from "react";
import { updateUserProfile } from "../services/api";

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

export default function ProfileNameModal({
  open,
  currentName,
  currentUsername,
  email,
  onClose,
  onSaved,
}) {
  const [name, setName] = useState(currentName || "");
  const [username, setUsername] = useState(currentUsername || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(currentName || "");
      setUsername(currentUsername || "");
      setError("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, currentName, currentUsername]);

  if (!open) return null;

  const handleSave = async () => {
    setError("");
    const trimmedName = name.trim();
    const trimmedUser = username.trim().toLowerCase();

    if (trimmedName && trimmedName.length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    if (trimmedUser && !/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUser)) {
      setError("Username: 3–30 characters, letters, numbers, underscore only.");
      return;
    }

    setLoading(true);
    try {
      const data = await updateUserProfile({
        name: trimmedName || currentName || "",
        username: trimmedUser,
      });
      onSaved?.({ name: data.name, username: data.username });
      onClose();
    } catch (err) {
      setError(err.message || "Could not save");
    }
    setLoading(false);
  };

  const preview =
    name.trim() || currentName || username.trim() || currentUsername || "You";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[440px] rounded-2xl bg-[#2f2f2f] dark:bg-[#2f2f2f] text-white shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="edit-profile-title"
      >
        <div className="px-6 pt-6 pb-2">
          <h2 id="edit-profile-title" className="text-lg font-semibold">
            Edit profile
          </h2>
        </div>

        <div className="flex flex-col items-center px-6 py-4">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
              {initials(preview)}
            </div>
          </div>

          <label className="w-full text-sm text-gray-300 mb-1.5">Display name</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full mb-4 px-4 py-2.5 rounded-lg bg-[#3f3f3f] border border-white/10 outline-none focus:ring-2 focus:ring-white/20 text-white placeholder:text-gray-500"
            placeholder="e.g. Noor fatima"
          />

          <label className="w-full text-sm text-gray-300 mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            maxLength={30}
            className="w-full mb-2 px-4 py-2.5 rounded-lg bg-[#3f3f3f] border border-white/10 outline-none focus:ring-2 focus:ring-white/20 text-white placeholder:text-gray-500"
            placeholder="e.g. noorfatimaanna"
          />
          <p className="w-full text-xs text-gray-400 mb-4">
            Your profile helps people recognize you in group chats.
          </p>

          {error && <p className="w-full text-sm text-red-400 mb-3">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-transparent hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
