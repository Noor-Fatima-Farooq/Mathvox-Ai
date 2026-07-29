import { useNavigate } from "react-router-dom";
import { BackArrowIcon } from "./icons";

export default function PageBackHeader({ title, backTo = "/chat" }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-800"
        aria-label="Go back"
      >
        <BackArrowIcon />
      </button>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
        {title}
      </h1>
    </div>
  );
}
