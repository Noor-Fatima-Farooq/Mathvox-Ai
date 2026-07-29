import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  clearChatSession,
  onLogout,
  NEW_CHAT_EVENT,
} from '../services/chatStorage';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const userId = localStorage.getItem("user_id");

  const menu = [
    { name: "New Chat", path: "/chat", icon: "fa-pen-to-square" },
    ...(userId
      ? [
          { name: "History", path: "/history", icon: "fa-clock-rotate-left" },
          { name: "Progress", path: "/dashboard", icon: "fa-chart-line" },
        ]
      : []),
  ];

  const handleNewChat = () => {
    clearChatSession();
    window.dispatchEvent(new Event(NEW_CHAT_EVENT));
    setIsOpen(false);
    if (location.pathname !== "/chat") {
      navigate("/chat");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    onLogout();
    setIsOpen(false);
    window.location.href = "/chat";
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 z-40"
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full w-72 
        bg-white dark:bg-slate-900 
        z-50 shadow-2xl 
        transform transition-transform duration-300 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-5 border-b dark:border-slate-700">
          <h2 className="text-xl font-bold">
            Math<span className="text-[#5d44f8]">Vox</span>
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-red-500 text-xl"
          >
            ✖
          </button>
        </div>

        <div className="flex flex-col p-4 gap-2">
          {menu.map((item, index) => {
            const isActive = location.pathname === item.path;
            const isNewChat = item.name === "New Chat";

            if (isNewChat) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={handleNewChat}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left
                    ${isActive && location.pathname === '/chat'
                      ? 'bg-[#5d44f8] text-white shadow-md'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                >
                  <i className={`fa-solid ${item.icon}`}></i>
                  <span className="font-medium">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={index}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${isActive
                    ? 'bg-[#5d44f8] text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
              >
                <i className={`fa-solid ${item.icon}`}></i>
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {userId && (
          <div className="absolute bottom-0 w-full p-4 border-t dark:border-slate-700">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 text-red-500 hover:text-red-600 w-full px-4 py-2 rounded-lg"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              Logout
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
