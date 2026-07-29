import React, { useState } from "react";
import { Link } from "react-router-dom";

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-4.42M9.88 5.09A10.77 10.77 0 0112 5c6.5 0 10 7 10 7a18.24 18.24 0 01-4.16 5.19M6.61 6.61A18.45 18.45 0 002 12s3.5 7 10 7a10.3 10.3 0 004.12-.84"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 p-8">
        <div className="flex justify-center mb-5">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 rounded-xl text-2xl text-white">
            🎓
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-500 dark:text-gray-400 text-center text-sm mt-2 mb-6">
            {subtitle}
          </p>
        )}

        {children}
        {footer}
      </div>
    </div>
  );
}

export function AuthInput({ label, ...props }) {
  return (
    <label className="block mb-4">
      {label && (
        <span className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
          {label}
        </span>
      )}
      <input
        className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 dark:text-white"
        {...props}
      />
    </label>
  );
}

export function AuthPasswordInput({ label, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block mb-4">
      {label && (
        <span className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
          {label}
        </span>
      )}
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-100 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900 dark:text-white"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={props.disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-40"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </label>
  );
}

export function AuthButton({ children, variant = "primary", ...props }) {
  const base =
    "w-full py-3 rounded-xl font-semibold transition-opacity disabled:opacity-50";
  const styles =
    variant === "google"
      ? "bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-800 dark:text-white flex items-center justify-center gap-2"
      : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white";
  return (
    <button type="button" className={`${base} ${styles}`} {...props}>
      {children}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
      <span className="text-xs text-gray-400 uppercase">or</span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
    </div>
  );
}

export function AuthLink({ to, children }) {
  return (
    <Link to={to} className="text-indigo-500 hover:text-indigo-600 font-medium">
      {children}
    </Link>
  );
}
