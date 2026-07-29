import React from "react";
import { Link } from "react-router-dom";

const LoginModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-4 text-xl text-gray-400 hover:text-black dark:hover:text-white"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold text-center mb-2">Join MathVox</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6">
          Save chats, track your math level, and sync across devices.
        </p>

        <Link
          to="/signup"
          onClick={onClose}
          className="block w-full text-center bg-gradient-to-r from-indigo-500 to-purple-600 py-3 rounded-xl font-semibold text-white mb-3"
        >
          Create account
        </Link>
        <Link
          to="/login"
          onClick={onClose}
          className="block w-full text-center border border-gray-300 dark:border-slate-600 py-3 rounded-xl font-semibold"
        >
          Log in
        </Link>
      </div>
    </div>
  );
};

export default LoginModal;
