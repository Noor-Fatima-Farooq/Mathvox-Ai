import React from 'react';
import { Link } from 'react-router-dom';
import { t } from '../translations';

const Home = () => {
  const features = [
    { icon: "fa-microphone", title: t.feat_voice, desc: t.feat_voice_desc },
    { icon: "fa-camera", title: t.feat_scan, desc: t.feat_scan_desc },
    { icon: "fa-trophy", title: t.feat_game, desc: t.feat_game_desc },
    { icon: "fa-book-open", title: t.feat_steps, desc: t.feat_steps_desc },
  ];

  return (
    <section className="flex flex-col items-center py-12 px-6 text-center transition-all duration-500">
      <div className="w-20 h-20 bg-[#5d44f8] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200 dark:shadow-none">
        <i className="fa-solid fa-graduation-cap text-white text-4xl"></i>
      </div>

      <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">{t.welcome}</p>

      <h1 className="text-6xl font-bold mb-4 text-gray-900 dark:text-white tracking-tight">
        Math<span className="text-[#5d44f8]">Vox</span>
      </h1>

      <p className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-6">
        {t.hero_sub}
      </p>

      <p className="max-w-3xl text-gray-500 dark:text-gray-400 leading-relaxed mb-12">
        {t.hero_desc}
      </p>

      <h3 className="text-gray-800 dark:text-gray-200 font-bold text-xl mb-10">
        {t.why_choose}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl mb-16">
        {features.map((item, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all duration-300"
          >
            <div className="w-10 h-10 bg-indigo-50 dark:bg-slate-700 text-[#5d44f8] dark:text-indigo-400 rounded-lg flex items-center justify-center mb-4 text-xl">
              <i className={`fa-solid ${item.icon}`}></i>
            </div>
            <h4 className="font-bold mb-2 text-gray-900 dark:text-white">{item.title}</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center mt-4">
        <Link to="/chat">
          <button className="bg-black dark:bg-white text-white dark:text-black px-10 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl">
            <i className="fa-solid fa-graduation-cap"></i>
            Get Started
          </button>
        </Link>
      </div>
    </section>
  );
};

export default Home;
