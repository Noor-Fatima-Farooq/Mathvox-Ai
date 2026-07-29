import React, { useEffect, useState } from "react";
import { getHistory, getProgressApi } from "../services/api";
import PageBackHeader from "../components/PageBackHeader";
import { formatHistoryDate } from "../utils/historyFormat";

const LEVEL_COLORS = {
  Beginner: "from-slate-500 to-slate-600",
  Intermediate: "from-indigo-500 to-violet-600",
  Pro: "from-amber-500 to-orange-600",
};

const Dashboard = () => {
  const [history, setHistory] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hist, prog] = await Promise.all([
          getHistory(),
          getProgressApi().catch(() => null),
        ]);
        setHistory(Array.isArray(hist) ? hist : []);
        setProgress(prog);
      } catch (err) {
        console.log("Dashboard error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const levelName = progress?.level_name || "Beginner";
  const points = progress?.total_points ?? 0;
  const solved = progress?.solved_questions ?? 0;
  const streak = progress?.streak ?? 0;
  const toNext = progress?.points_to_next_level ?? 100;
  const nextName = progress?.next_level_name;

  const levelMax =
    levelName === "Pro" ? 200 : levelName === "Intermediate" ? 200 : 100;
  const levelMin =
    levelName === "Intermediate" ? 100 : levelName === "Pro" ? 200 : 0;
  const barPct =
    levelName === "Pro"
      ? 100
      : Math.min(
          100,
          Math.round(((points - levelMin) / (levelMax - levelMin)) * 100)
        );

  return (
    <div className="p-6 md:p-8 text-gray-900 dark:text-white max-w-4xl mx-auto">
      <PageBackHeader title="Progress" backTo="/chat" />

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Points and levels come from real math solves only — chat messages and
        failed attempts do not count.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <>
          <div
            className={`p-6 mb-6 rounded-2xl bg-gradient-to-r ${LEVEL_COLORS[levelName] || LEVEL_COLORS.Beginner} text-white shadow-lg`}
          >
            <p className="text-sm opacity-90">Your level</p>
            <p className="text-3xl font-bold mt-1">{levelName}</p>
            {nextName && toNext > 0 && (
              <p className="text-sm mt-2 opacity-90">
                {toNext} points to {nextName}
              </p>
            )}
            {levelName === "Pro" && (
              <p className="text-sm mt-2 opacity-90">Top level reached</p>
            )}
            <div className="mt-4 h-2 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl shadow border border-gray-100 dark:border-slate-700">
              <p className="text-sm text-gray-500">Problems solved</p>
              <p className="text-3xl font-bold mt-1">{solved}</p>
              <p className="text-xs text-gray-400 mt-1">Unique successful solves</p>
            </div>
            <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl shadow border border-gray-100 dark:border-slate-700">
              <p className="text-sm text-gray-500">Points</p>
              <p className="text-3xl font-bold mt-1">{points}</p>
              <p className="text-xs text-gray-400 mt-1">10 per problem · worksheets capped</p>
            </div>
            <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl shadow border border-gray-100 dark:border-slate-700">
              <p className="text-sm text-gray-500">Day streak</p>
              <p className="text-3xl font-bold mt-1">{streak}</p>
              <p className="text-xs text-gray-400 mt-1">Solve at least once per day</p>
            </div>
          </div>

          <section>
            <h2 className="text-lg font-bold mb-3">Recent solves</h2>
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Your latest worksheet and problem solves will show here.
              </p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-100 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">
                        {formatHistoryDate(item.created_at)}
                      </span>
                      {item.entry_type === "worksheet" && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-300">
                          · {item.problem_count} problems
                        </span>
                      )}
                    </div>
                    <p className="font-medium truncate">{item.question}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;
