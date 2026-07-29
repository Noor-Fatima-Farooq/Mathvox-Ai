import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageBackHeader from "../components/PageBackHeader";
import { getProgressActivity } from "../services/api";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

export default function Progress() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getProgressActivity());
    } catch (e) {
      setError(e.message || "Could not load progress");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const streak = data?.test_streak ?? 0;

  return (
    <div className="p-6 md:p-8 text-gray-900 dark:text-white max-w-4xl mx-auto min-h-screen pb-12">
      <PageBackHeader title="Progress" backTo="/chat" />

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-sm">
              <p>{error}</p>
              <button type="button" onClick={load} className="mt-2 text-[#5d44f8] text-sm font-medium">
                Retry
              </button>
            </div>
          )}

          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg">
            <p className="text-sm opacity-90">Daily test streak</p>
            <p className="text-5xl font-bold flex items-center gap-3 mt-2">
              <span aria-hidden>🔥</span>
              <span>{streak}</span>
              <span className="text-lg font-normal opacity-80">days</span>
            </p>
            <p className="text-sm mt-3 opacity-90">
              {data?.completed_test_today
                ? "You kept your streak today — nice!"
                : data?.streak_at_risk
                  ? "⚠️ Do a 5-question skill check today or you lose your streak tomorrow!"
                  : streak === 0
                    ? "Complete one full skill check per day to start your streak."
                    : "Complete one 5-question skill check today to keep the streak alive."}
            </p>
            {!data?.completed_test_today && (
              <Link
                to="/skills"
                className="inline-block mt-4 px-4 py-2 rounded-lg bg-white text-orange-600 font-semibold text-sm hover:bg-orange-50"
              >
                Go to skill check →
              </Link>
            )}
          </div>

          {data?.grand_total_points > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              All-time points from skill checks:{" "}
              <strong className="text-gray-900 dark:text-white">{data.grand_total_points}</strong>
            </p>
          )}

          <h2 className="text-lg font-bold mb-3">Activity by date</h2>

          {!data?.daily_log?.length ? (
            <p className="text-gray-500 text-sm">
              No skill checks yet.{" "}
              <Link to="/skills" className="text-[#5d44f8] hover:underline">
                Take your first test
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-6">
              {data.daily_log.map((day) => (
                <div
                  key={day.date}
                  className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
                >
                  <div className="px-4 py-3 bg-gray-50 dark:bg-slate-900/50 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold">{formatDate(day.date)}</span>
                    <span className="text-gray-600 dark:text-gray-300">
                      {day.exercise_count} exercise{day.exercise_count !== 1 ? "s" : ""} ·{" "}
                      <strong className="text-[#5d44f8]">+{day.total_points} pts</strong> ·{" "}
                      {formatDuration(day.total_time_seconds)} total
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-slate-700">
                          <th className="px-4 py-2 font-medium">Exercise</th>
                          <th className="px-4 py-2 font-medium">Score</th>
                          <th className="px-4 py-2 font-medium">Time</th>
                          <th className="px-4 py-2 font-medium text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.exercises.map((ex) => (
                          <tr
                            key={ex.session_id}
                            className="border-b border-gray-50 dark:border-slate-700/50 last:border-0"
                          >
                            <td className="px-4 py-2.5">{ex.topic_label}</td>
                            <td className="px-4 py-2.5">
                              {ex.score}/{ex.total}
                            </td>
                            <td className="px-4 py-2.5">
                              {formatDuration(ex.total_time_seconds)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-[#5d44f8]">
                              +{ex.points_earned}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
