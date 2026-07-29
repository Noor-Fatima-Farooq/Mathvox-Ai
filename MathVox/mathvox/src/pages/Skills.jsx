import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageBackHeader from "../components/PageBackHeader";
import {
  getAssessmentTopics,
  getSkillProfile,
  getTopicSkillDetail,
  startAssessment,
  submitAssessmentAnswer,
} from "../services/api";

const FALLBACK_TOPICS = [
  { id: "arithmetic", label: "Arithmetic (+, −, ×, ÷)" },
  { id: "fractions", label: "Fractions" },
  { id: "decimals", label: "Decimals" },
  { id: "linear_equations", label: "Linear equations" },
  { id: "quadratics", label: "Quadratics" },
  { id: "word_problems", label: "Word problems" },
];

function buildFallbackProfile(topics) {
  const skills = topics.map((t) => ({
    topic: t.id,
    label: t.label,
    mastery: 0,
    level_band: "Beginner",
    topic_points: 0,
    attempts: 0,
    correct_count: 0,
    wrong_count: 0,
  }));
  const first = skills[0];
  return {
    skills,
    total_points: 0,
    test_streak: 0,
    overall_mastery: 0,
    overall_band: "Starter",
    weakest_topic: first?.topic ?? "arithmetic",
    weakest_label: first?.label ?? "Arithmetic",
    weakest_mastery: 0,
    test_history: [],
    _offline: true,
  };
}

const BAND_COLORS = {
  Beginner: "bg-slate-400",
  Developing: "bg-blue-500",
  Proficient: "bg-indigo-500",
  Advanced: "bg-amber-500",
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SkillTopicCard({ skill, isWeakest, onStart, onDetail, disabled }) {
  const weak = skill.mastery < 40;
  return (
    <div
      className={`p-4 rounded-xl border bg-white dark:bg-slate-800 shadow-sm ${
        isWeakest
          ? "border-red-300 dark:border-red-800 ring-1 ring-red-200"
          : "border-gray-100 dark:border-slate-700"
      }`}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <button
          type="button"
          onClick={() => onDetail(skill.topic)}
          className="text-left flex-1 min-w-0"
        >
          <p className="font-semibold text-gray-900 dark:text-white truncate">
            {skill.label}
          </p>
          <span
            className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full text-white ${
              BAND_COLORS[skill.level_band] || BAND_COLORS.Beginner
            }`}
          >
            {skill.level_band}
          </span>
        </button>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-[#5d44f8]">{skill.mastery}%</p>
          <p className="text-xs text-gray-500">{skill.topic_points} pts</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-slate-700 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full ${weak ? "bg-red-500" : "bg-[#5d44f8]"}`}
          style={{ width: `${skill.mastery}%` }}
        />
      </div>
      {isWeakest && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">Weakest area</p>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onStart(skill.topic)}
        className="w-full py-2 rounded-lg bg-[#5d44f8] text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
      >
        Start skill check
      </button>
    </div>
  );
}

function TopicDetailModal({ detail, onClose, onStart }) {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold">{detail.label}</h3>
            <p className="text-sm text-gray-500">
              {detail.level_band} · {detail.mastery}% mastery
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400">
            ×
          </button>
        </div>
        {detail.is_weakest && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">
            This is your weakest topic right now.
          </p>
        )}
        <p className="text-sm mb-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40">
          <strong>How to improve:</strong> {detail.improvement_tip}
        </p>
        {detail.test_history?.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold mb-2">Past tests</p>
            <ul className="space-y-1 text-sm">
              {detail.test_history.map((t) => (
                <li
                  key={t.session_id}
                  className="flex justify-between text-gray-600 dark:text-gray-300"
                >
                  <span>{formatDate(t.test_date || t.finished_at)}</span>
                  <span>
                    {t.score}/{t.total} · {t.points_earned} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            onStart(detail.topic);
            onClose();
          }}
          className="w-full py-2.5 rounded-xl bg-[#5d44f8] text-white font-medium"
        >
          Start skill check on this topic
        </button>
      </div>
    </div>
  );
}

export default function Skills() {
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [answer, setAnswer] = useState("");
  const [quizBusy, setQuizBusy] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);
  const [topicDetail, setTopicDetail] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const questionStartRef = useRef(null);
  const elapsedTimerRef = useRef(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setProfile(await getSkillProfile());
    } catch (e) {
      console.error(e);
      setLoadError(e.message || "Could not load your skill profile");
      try {
        const topics = await getAssessmentTopics();
        setProfile(buildFallbackProfile(topics));
      } catch {
        setProfile(buildFallbackProfile(FALLBACK_TOPICS));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!quiz) {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      return undefined;
    }
    questionStartRef.current = Date.now();
    setElapsedSec(0);
    elapsedTimerRef.current = setInterval(() => {
      if (questionStartRef.current) {
        setElapsedSec(Math.floor((Date.now() - questionStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(elapsedTimerRef.current);
  }, [quiz?.session_id, quiz?.index]);

  const handleStartQuiz = async (topic) => {
    setQuizBusy(true);
    setLastSummary(null);
    try {
      setQuiz(await startAssessment(topic));
      setAnswer("");
    } catch (e) {
      alert(e.message || "Could not start test");
    } finally {
      setQuizBusy(false);
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!quiz?.session_id || !answer.trim()) return;
    const elapsed = questionStartRef.current
      ? Math.round((Date.now() - questionStartRef.current) / 1000)
      : elapsedSec;

    setQuizBusy(true);
    try {
      const data = await submitAssessmentAnswer(
        quiz.session_id,
        answer.trim(),
        elapsed
      );
      if (data.finished) {
        setQuiz(null);
        setAnswer("");
        setLastSummary(data.summary);
        await loadProfile();
      } else {
        setQuiz((q) => ({
          ...q,
          question: data.question,
          index: data.index,
          total: data.total,
          difficulty: data.difficulty,
        }));
        setAnswer("");
      }
    } catch (err) {
      alert(err.message || "Submit failed");
    } finally {
      setQuizBusy(false);
    }
  };

  const weakest = profile?.weakest_topic;
  const weakTopics = profile?.weak_topics || [];
  const needsNag =
    profile &&
    (profile.weakest_mastery < 50 || weakTopics.length > 0 || profile.overall_mastery < 40);

  return (
    <div className="p-6 md:p-8 text-gray-900 dark:text-white max-w-3xl mx-auto min-h-screen pb-12">
      <PageBackHeader title="My math level" backTo="/chat" />

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <>
          {loadError && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">{loadError}</p>
              <p className="mt-1 text-amber-800 dark:text-amber-200">
                Topics are shown below. Start the backend at{" "}
                <code className="text-xs">http://127.0.0.1:8080</code> and tap Retry.
              </p>
              <button
                type="button"
                onClick={loadProfile}
                className="mt-2 text-sm font-medium text-[#5d44f8] hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          {needsNag && (
            <div className="mb-6 p-4 rounded-xl border-2 border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/40">
              <p className="text-sm font-bold text-red-800 dark:text-red-200 mb-2">
                Weak areas — fix these now
              </p>
              <p className="text-sm text-red-900 dark:text-red-100 mb-3">{profile.recommendation}</p>
              {weakTopics.length > 0 && (
                <ul className="text-sm space-y-1 mb-3">
                  {weakTopics.map((w) => (
                    <li key={w.topic} className="flex justify-between text-red-800 dark:text-red-200">
                      <span>{w.label}</span>
                      <span className="font-semibold">{w.mastery}%</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleStartQuiz(weakest)}
                  disabled={!!quiz || quizBusy}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  Test weakest topic now
                </button>
                <Link
                  to="/progress"
                  className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  View streak and history
                </Link>
              </div>
            </div>
          )}

          <div className="mb-6 p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
            <div className="flex justify-between text-sm mb-2">
              <span>
                Overall: <strong>{profile?.overall_band}</strong> (
                {profile?.overall_mastery}%)
              </span>
              <button
                type="button"
                onClick={() => getTopicSkillDetail(weakest).then(setTopicDetail)}
                className="text-[#5d44f8] text-xs hover:underline"
              >
                Weakest: {profile?.weakest_label} →
              </button>
            </div>
            <div className="h-3 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#5d44f8] to-indigo-400 rounded-full"
                style={{ width: `${profile?.overall_mastery ?? 0}%` }}
              />
            </div>
          </div>

          {lastSummary && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 text-sm">
              <p className="font-semibold">
                Done {lastSummary.score}/{lastSummary.total} · +{lastSummary.points_earned}{" "}
                pts · avg {lastSummary.avg_time_seconds}s/q
              </p>
              <p className="mt-1">{lastSummary.message}</p>
              {lastSummary.streak && (
                <p className="mt-2">🔥 Streak: {lastSummary.streak.test_streak} days</p>
              )}
            </div>
          )}

          {quiz && (
            <form
              onSubmit={handleSubmitAnswer}
              className="mb-8 p-5 rounded-2xl border-2 border-[#5d44f8]/40 bg-white dark:bg-slate-800"
            >
              <div className="flex justify-between mb-2">
                <p className="text-xs text-gray-500">
                  Q{quiz.index}/{quiz.total} · {quiz.topic_label}
                </p>
                <p className="font-mono font-bold text-[#5d44f8]">
                  {elapsedSec}s <span className="text-xs font-normal text-gray-500">elapsed</span>
                </p>
              </div>
              <p className="text-lg font-semibold mb-4">{quiz.question}</p>
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full mb-3 px-3 py-2 rounded-lg border dark:bg-slate-900"
                disabled={quizBusy}
                autoFocus
              />
              <button
                type="submit"
                disabled={quizBusy || !answer.trim()}
                className="px-4 py-2 rounded-lg bg-[#5d44f8] text-white disabled:opacity-50"
              >
                Submit
              </button>
            </form>
          )}

          <h2 className="text-lg font-bold mb-3">Topics</h2>
          <div className="grid gap-3 mb-10">
            {(profile?.skills?.length ? profile.skills : buildFallbackProfile(FALLBACK_TOPICS).skills).map((s) => (
              <SkillTopicCard
                key={s.topic}
                skill={s}
                isWeakest={s.topic === weakest}
                onStart={handleStartQuiz}
                onDetail={(t) => getTopicSkillDetail(t).then(setTopicDetail)}
                disabled={!!quiz || quizBusy}
              />
            ))}
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Streak and points history are on{" "}
            <Link to="/progress" className="text-[#5d44f8] font-medium hover:underline">
              Progress
            </Link>
            .
          </p>
        </>
      )}

      <TopicDetailModal
        detail={topicDetail}
        onClose={() => setTopicDetail(null)}
        onStart={handleStartQuiz}
      />
    </div>
  );
}
