import React, { useState } from 'react';
import { Link, useLocation } from "react-router-dom";
import LoginModal from './LoginModal';
import { onLogout } from '../services/chatStorage';

const Navbar = ({ isDark, setIsDark }) => {
  const [showLogin, setShowLogin] = useState(false);

  const location = useLocation();
  const isChatPage = location.pathname === '/chat';

  const userId = localStorage.getItem("user_id");
  if (isChatPage && userId) {
    return <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />;
  }

  return (
    <>
      <nav className="flex items-center justify-between px-4 md:px-6 py-3 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white"
          >
            Math<span className="text-[#5d44f8]">Vox</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="text-lg"
            aria-label="Toggle dark mode"
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {!userId ? (
            <>
              <Link
                to="/signup"
                className="hidden sm:inline text-sm font-medium text-[#5d44f8]"
              >
                Sign up
              </Link>
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="bg-[#5d44f8] text-white px-3 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-sm"
              >
                Login
              </button>
            </>
          ) : (
            !isChatPage && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("user_id");
                  onLogout();
                  window.location.href = "/chat";
                }}
                className="bg-red-500 text-white px-3 py-1 md:px-4 md:py-2 rounded-lg text-sm"
              >
                Logout
              </button>
            )
          )}
        </div>
      </nav>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
};

export default Navbar;
