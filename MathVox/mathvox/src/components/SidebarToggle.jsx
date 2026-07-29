import { SidebarPanelIcon } from "./icons";

/** ChatGPT-style: panel icon at seam; hover reveals long chevron + label */
export default function SidebarToggle({ sidebarOpen, onClick, className = "" }) {
  const label = sidebarOpen ? "Close sidebar" : "Open sidebar";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex items-center h-9 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800/90 transition-colors ${className}`}
      aria-label={label}
    >
      <span className="flex items-center justify-center w-9 h-9 shrink-0">
        <SidebarPanelIcon />
      </span>
      <span
        className="flex items-center overflow-hidden max-w-0 opacity-0 group-hover:max-w-[148px] group-hover:opacity-100 group-hover:pr-2 transition-all duration-200 ease-out"
        aria-hidden
      >
        <svg
          className="w-5 h-5 shrink-0 text-gray-500 dark:text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {sidebarOpen ? (
            <path d="M15 18l-6-6 6-6" />
          ) : (
            <path d="M9 18l6-6-6-6" />
          )}
        </svg>
        <span className="ml-1 text-xs font-medium whitespace-nowrap text-gray-600 dark:text-gray-300">
          {label}
        </span>
      </span>
    </button>
  );
}
