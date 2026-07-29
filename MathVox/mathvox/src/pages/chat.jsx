import React, { useState, useEffect, useRef, useCallback } from 'react';
import { t } from '../translations';
import {
  solveQuestion,
  explainSteps,
  formatSolveResponse,
  chatWithContext,
  askTutor,
} from '../services/api';
import {
  recognizeMathImage,
  getProblemForSolve,
  countProblemsForLabel,
} from '../services/ocr';
import ChatSidebar from '../components/ChatSidebar';
import SidebarToggle from '../components/SidebarToggle';
import {
  loadChatSession,
  saveChatSession,
  isLoggedIn,
  purgeGuestSession,
  createNewThread,
  getActiveThreadId,
  listChatThreads,
  isSidebarCollapsed,
  setSidebarCollapsed,
  NEW_CHAT_EVENT,
  THREAD_SELECT_EVENT,
  THREAD_DELETED_EVENT,
  ensureServerThread,
  loadThreadFromServer,
  createNewThreadServer,
  usesServerChats,
} from '../services/chatStorage';
import { syncUserProfileFromServer } from '../services/api';
import {
  getReplyStylePreference,
  setReplyStylePreference,
  resolveReplyStyleForMessage,
  applyPreferenceUpdate,
  formatSolveForStyle,
  REPLY_STYLE_EVENT,
} from '../services/replyLanguage';

const Chat = ({ isDark = false, setIsDark }) => {
  const saved = isLoggedIn() ? loadChatSession() : null;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(isSidebarCollapsed);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false
  );

  const handleSidebarToggle = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen((open) => !open);
      return;
    }
    setSidebarCollapsedState((collapsed) => {
      const next = !collapsed;
      setSidebarCollapsed(next);
      if (next) setSidebarOpen(false);
      return next;
    });
  }, []);
  const [activeThreadId, setActiveThreadId] = useState(saved?.threadId || null);
  const [question, setQuestion] = useState(saved?.question || "");
  const [messages, setMessages] = useState(saved?.messages || []);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [lastSolved, setLastSolved] = useState(saved?.lastSolved || null);

  const [dictating, setDictating] = useState(false);
  const [voiceChatActive, setVoiceChatActive] = useState(false);
  const [voicePhase, setVoicePhase] = useState("idle");
  const [replyStyle, setReplyStyle] = useState(() => getReplyStylePreference());

  const bottomRef = useRef(null);
  const questionInputRef = useRef(null);
  const extractedInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const resizeTextarea = (el, maxPx = 200) => {
    if (!el) return;
    const minPx = 40;
    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, minPx), maxPx);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  };
  const dictationRef = useRef(null);
  const convRecognitionRef = useRef(null);
  const voiceChatActiveRef = useRef(false);
  const attachmentUrlRef = useRef(null);
  const lastSolvedRef = useRef(null);
  const activeThreadIdRef = useRef(activeThreadId);

  useEffect(() => {
    lastSolvedRef.current = lastSolved;
  }, [lastSolved]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const speechLang = () => "en-US";

  const formatExplanation = (data, style = replyStyle) => {
    const steps = data.steps;
    const body = Array.isArray(steps)
      ? steps.map((step, i) => `${i + 1}. ${step}`).join("\n\n")
      : String(steps);
    if (!data.final_answer) return body;
    const footer =
      style === "ur_roman"
        ? `Aakhri jawab: ${data.final_answer}`
        : `Final answer: ${data.final_answer}`;
    return `${body}\n\n${footer}`;
  };

  const firstLine = (text) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || text.trim();

  const pushUserMessage = (text, imageUrl = null, viaVoice = false) => {
    setMessages((prev) => [
      ...prev,
      { type: "user", text, imageUrl: imageUrl || null, viaVoice },
    ]);
  };

  const pushBotMessage = (text, viaVoice = false) => {
    setMessages((prev) => [...prev, { type: "bot", text, viaVoice }]);
  };

  const pushBotError = (prefix, detail) => {
    pushBotMessage(`${prefix}: ${detail || "error"}`);
  };

  const speakTextAsync = (text) =>
    new Promise((resolve) => {
      if (!window.speechSynthesis || !text?.trim()) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(
        text.replace(/\n+/g, ". ").slice(0, 2500)
      );
      utter.lang = speechLang();
      utter.rate = 0.92;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });

  const speakText = (text) => {
    speakTextAsync(text);
  };

  const revokeAttachmentUrl = () => {
    if (attachmentUrlRef.current) {
      URL.revokeObjectURL(attachmentUrlRef.current);
      attachmentUrlRef.current = null;
    }
  };

  const clearImageAttachment = (revokeUrl = true) => {
    if (revokeUrl) revokeAttachmentUrl();
    else attachmentUrlRef.current = null;
    setImageAttachment(null);
    setOcrLoading(false);
    setOcrProgress(0);
  };

  const getFullInput = () => {
    const fromAttachment = imageAttachment?.extractedText?.trim();
    const fromInput = question.trim();
    return fromAttachment || fromInput;
  };

  const getSolveText = () => getProblemForSolve(getFullInput());

  const wantsExplain = (text) =>
    /\b(explain|steps|solution steps|step by step|show steps|how did you|why is that)\b/i.test(
      text
    );

  const hasMathContent = (text) => {
    const t = (text || "").trim();
    if (!t) return false;
    if (countProblemsForLabel(t) > 0) return true;
    if (/[xyzXYZ]/.test(t) && /\d/.test(t)) return true;
    if (/\d\s*[+\-*/^=]/.test(t)) return true;
    return false;
  };

  const isExplainFollowUp = (text) => wantsExplain(text) && !hasMathContent(text);

  const stripSolveLabel = (text) =>
    (text || "").replace(/^Solve all \(\d+ problems\):\s*/i, "").trim();

  const extractAnswerFromBot = (botText) => {
    if (!botText) return null;
    const lines = botText.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/=\s*(.+)$/);
      if (m) return m[1].trim();
    }
    return lines[0] || null;
  };

  const findLastMathFromMessages = (msgs) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].type !== "bot") continue;
      const user = msgs[i - 1];
      if (user?.type !== "user") continue;
      const raw = stripSolveLabel(user.text || "");
      const firstLine = raw.split("\n").map((l) => l.trim()).find(Boolean) || raw;
      const problem = hasMathContent(firstLine)
        ? firstLine
        : hasMathContent(raw)
          ? raw.split("\n")[0].trim()
          : null;
      if (!problem) continue;
      return {
        question: problem,
        answer: extractAnswerFromBot(msgs[i].text),
      };
    }
    return null;
  };

  const resolveMathContext = (userText) => {
    if (lastSolvedRef.current?.question) {
      return lastSolvedRef.current;
    }
    if (hasMathContent(userText)) {
      return { question: userText.trim(), answer: null };
    }
    return findLastMathFromMessages(messages);
  };

  const shouldSolveMath = (text) => {
    const t = text.trim();
    if (!t) return false;
    if (wantsExplain(t)) return false;
    if (/^(hi+|hello|hey|thanks|thank you|ok+)\b/i.test(t) && t.length < 50) {
      return false;
    }
    if (countProblemsForLabel(t) > 0) return true;
    if (/\d\s*[+\-*/^]\s*\d/.test(t) && !/^[0-9+\-*/().=\s\n]+$/i.test(t)) return true;
    if (/[xyzXYZ]/.test(t) && /\d/.test(t)) return true;
    if (/^[0-9+\-*/().=xXyYzZ?\s\n]+$/i.test(t) && /\d/.test(t)) return true;
    return false;
  };

  const buildChatHistory = () =>
    messages.slice(-16).map((m) => ({
      role: m.type === "user" ? "user" : "assistant",
      text: m.text,
    }));

  const fetchBotReply = async (text) => {
    const style = resolveReplyStyleForMessage(text);

    if (usesServerChats()) {
      let tid = activeThreadIdRef.current;
      if (!tid) {
        tid = await ensureServerThread();
        if (tid) setActiveThreadId(tid);
      }
      if (!tid) {
        tid = await createNewThreadServer();
        setActiveThreadId(tid);
      }
      const data = await askTutor(tid, text, style);
      applyPreferenceUpdate(data.preference_update);
      if (data.last_solved) {
        lastSolvedRef.current = data.last_solved;
        setLastSolved(data.last_solved);
      }
      return data.reply;
    }

    if (wantsExplain(text)) {
      const ctx = resolveMathContext(text);
      const problem = hasMathContent(text) ? text.trim() : ctx?.question;

      if (!problem) {
        const { reply } = await chatWithContext(text, buildChatHistory(), style);
        return (
          reply ||
          (style === "ur_roman"
            ? "Pehle koi math masla solve karo, phir samjhane ko kaho."
            : "Solve a math problem first, then ask me to explain it.")
        );
      }

      const cachedAnswer =
        ctx?.answer &&
        (ctx.question === problem || lastSolvedRef.current?.question === problem)
          ? ctx.answer
          : lastSolvedRef.current?.question === problem
            ? lastSolvedRef.current.answer
            : ctx?.answer || null;

      const data = await explainSteps(problem, style, cachedAnswer);
      if (data.final_answer) {
        lastSolvedRef.current = { question: problem, answer: data.final_answer };
        setLastSolved(lastSolvedRef.current);
      }
      return formatExplanation(data, style);
    }

    if (!shouldSolveMath(text)) {
      const { reply } = await chatWithContext(text, buildChatHistory(), style);
      return (
        reply ||
        (style === "ur_roman"
          ? "Main math mein madad ke liye hoon — koi sawal poochho."
          : "I'm here to help with math — ask a question or paste a problem.")
      );
    }

    const data = await solveQuestion(text);
    let answer;
    try {
      answer = formatSolveForStyle(data, style);
    } catch {
      answer = formatSolveResponse(data);
    }
    const solved = data.results?.length
      ? data.results.filter((r) => r.answer && !r.error).pop()
      : data;
    if (solved?.answer) {
      lastSolvedRef.current = {
        question: solved.question || text,
        answer: solved.answer,
      };
      setLastSolved(lastSolvedRef.current);
    }
    return answer;
  };

  const stopVoiceChat = useCallback(() => {
    voiceChatActiveRef.current = false;
    setVoiceChatActive(false);
    setVoicePhase("idle");
    convRecognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  const processVoiceTurn = useCallback(
    async (transcript) => {
      const text = firstLine(transcript);
      if (!text) {
        if (voiceChatActiveRef.current) startConversationListen();
        return;
      }

      pushUserMessage(text, null, true);
      setVoicePhase("thinking");
      setLoading(true);

      try {
        const botText = await fetchBotReply(text);
        pushBotMessage(botText, true);
        setVoicePhase("speaking");
        await speakTextAsync(botText);
      } catch (err) {
        const msg =
          err.message === "Failed to fetch"
            ? "Backend not running. Start uvicorn on port 8080."
            : err.message || "Request failed";
        pushBotMessage(msg, true);
        if (voiceChatActiveRef.current) {
          setVoicePhase("speaking");
          await speakTextAsync(msg);
        }
      }

      setLoading(false);
      if (voiceChatActiveRef.current) {
        setVoicePhase("listening");
        startConversationListen();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const startConversationListen = useCallback(() => {
    if (!voiceChatActiveRef.current) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      pushBotError("Voice chat", "use Chrome or Edge");
      stopVoiceChat();
      return;
    }

    try {
      convRecognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const rec = new SpeechRecognition();
    rec.lang = speechLang();
    rec.continuous = false;
    rec.interimResults = false;

    let said = "";

    rec.onresult = (event) => {
      said = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
    };

    rec.onend = () => {
      if (!voiceChatActiveRef.current) return;
      if (said.trim()) {
        processVoiceTurn(said);
      } else {
        startConversationListen();
      }
    };

    rec.onerror = () => {
      if (voiceChatActiveRef.current) {
        setTimeout(() => startConversationListen(), 400);
      }
    };

    convRecognitionRef.current = rec;
    rec.start();
    setVoicePhase("listening");
  }, [processVoiceTurn, stopVoiceChat, voicePhase]);

  const startVoiceChat = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      pushBotError("Voice chat", "use Chrome or Edge");
      return;
    }
    window.speechSynthesis?.cancel();
    dictationRef.current?.abort();
    setDictating(false);

    voiceChatActiveRef.current = true;
    setVoiceChatActive(true);
    pushBotMessage("Voice mode on. Speak your math question.", true);
    startConversationListen();
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, ocrLoading, imageAttachment, dictating, voicePhase]);

  useEffect(() => {
    resizeTextarea(questionInputRef.current, 200);
  }, [question]);

  useEffect(() => {
    resizeTextarea(extractedInputRef.current, 280);
  }, [imageAttachment?.extractedText]);

  useEffect(() => {
    if (!isLoggedIn()) {
      purgeGuestSession();
      return;
    }
    if (!usesServerChats()) {
      saveChatSession({
        threadId: activeThreadId,
        messages,
        lastSolved,
        question,
      });
    }
  }, [messages, lastSolved, question, activeThreadId]);

  useEffect(() => {
    if (!isLoggedIn()) {
      purgeGuestSession();
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) return;
    (async () => {
      if (usesServerChats()) {
        const tid = await ensureServerThread();
        if (!tid) return;
        setActiveThreadId(tid);
        const session = await loadThreadFromServer(tid);
        setMessages(session.messages || []);
        setLastSolved(session.lastSolved || null);
        return;
      }
      const threads = listChatThreads();
      if (!threads.length) {
        const id = createNewThread();
        setActiveThreadId(id);
      } else if (!activeThreadId) {
        setActiveThreadId(getActiveThreadId() || threads[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onNewChat = () => {
      setMessages([]);
      setQuestion("");
      setLastSolved(null);
      clearImageAttachment(true);
      setActiveThreadId(getActiveThreadId());
    };
    const onSelectThread = async (e) => {
      const id = e.detail?.threadId;
      if (!id) return;
      if (usesServerChats()) {
        try {
          const session = await loadThreadFromServer(id);
          setActiveThreadId(session.threadId);
          setMessages(session.messages || []);
          setQuestion("");
          setLastSolved(session.lastSolved || null);
          clearImageAttachment(true);
        } catch (err) {
          console.error(err);
        }
        return;
      }
      const session = loadChatSession(id);
      if (!session) return;
      setActiveThreadId(session.threadId);
      setMessages(session.messages || []);
      setQuestion(session.question || "");
      setLastSolved(session.lastSolved || null);
      clearImageAttachment(true);
    };
    const onThreadDeleted = async (e) => {
      if (!e.detail?.wasActive) return;
      if (usesServerChats()) {
        const tid = getActiveThreadId();
        if (tid) {
          try {
            const session = await loadThreadFromServer(tid);
            setActiveThreadId(session.threadId);
            setMessages(session.messages || []);
            setLastSolved(session.lastSolved || null);
          } catch {
            setMessages([]);
          }
        } else {
          setMessages([]);
        }
      } else {
        const session = loadChatSession(getActiveThreadId());
        if (session) {
          setActiveThreadId(session.threadId);
          setMessages(session.messages || []);
          setQuestion(session.question || "");
          setLastSolved(session.lastSolved || null);
        } else {
          setActiveThreadId(getActiveThreadId());
          setMessages([]);
          setQuestion("");
          setLastSolved(null);
        }
      }
      clearImageAttachment(true);
    };

    window.addEventListener(NEW_CHAT_EVENT, onNewChat);
    window.addEventListener(THREAD_SELECT_EVENT, onSelectThread);
    window.addEventListener(THREAD_DELETED_EVENT, onThreadDeleted);
    return () => {
      window.removeEventListener(NEW_CHAT_EVENT, onNewChat);
      window.removeEventListener(THREAD_SELECT_EVENT, onSelectThread);
      window.removeEventListener(THREAD_DELETED_EVENT, onThreadDeleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      revokeAttachmentUrl();
      stopVoiceChat();
      dictationRef.current?.abort();
    };
  }, [stopVoiceChat]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    return () => dictationRef.current?.abort();
  }, []);

  const toggleDictation = () => {
    if (voiceChatActive) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      pushBotError("Voice", "use Chrome or Edge");
      return;
    }

    if (dictating) {
      dictationRef.current?.stop();
      setDictating(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = speechLang();
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setQuestion(transcript);
      if (imageAttachment) {
        setImageAttachment((prev) =>
          prev ? { ...prev, extractedText: transcript } : prev
        );
      }
    };

    rec.onend = () => setDictating(false);
    rec.onerror = () => setDictating(false);

    dictationRef.current = rec;
    try {
      rec.start();
      setDictating(true);
    } catch {
      pushBotError("Voice", "microphone permission denied");
    }
  };

  const runSolve = async () => {
    const text = getSolveText();
    if (!text) return;

    const imageUrl = imageAttachment?.previewUrl || null;
    const n = countProblemsForLabel(text);
    const label =
      n > 1 ? `Solve all (${n} problems):\n${text}` : text;
    pushUserMessage(label, imageUrl);
    clearImageAttachment(false);
    setQuestion("");
    setLoading(true);

    try {
      const botText = await fetchBotReply(text);
      pushBotMessage(botText);
      setPoints(0);
    } catch (err) {
      pushBotError(
        "Solve failed",
        err.message === "Failed to fetch"
          ? "backend not running — start uvicorn on port 8080"
          : err.message
      );
    }

    setLoading(false);
  };

  const runExplain = async () => {
    const full = getFullInput().trim();
    const imageUrl = imageAttachment?.previewUrl || null;
    const userLabel = full || "Explain the last problem";
    pushUserMessage(userLabel, imageUrl);
    clearImageAttachment(false);
    setQuestion("");
    setLoading(true);

    try {
      const botText = await fetchBotReply(userLabel);
      pushBotMessage(botText);
    } catch (err) {
      pushBotError(
        "Explain failed",
        err.message === "Failed to fetch"
          ? "backend not running — start uvicorn on port 8080"
          : err.message
      );
    }

    setLoading(false);
  };

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    revokeAttachmentUrl();
    const previewUrl = URL.createObjectURL(file);
    attachmentUrlRef.current = previewUrl;

    setImageAttachment({ previewUrl, file, extractedText: "" });
    setOcrLoading(true);
    setOcrProgress(0);

    try {
      const { text, hint, source, problem_count: problemCount } =
        await recognizeMathImage(file, setOcrProgress);
      if (!text?.trim()) {
        throw new Error(
          hint || "No text found. Add GROQ_API_KEY in mathvox-backend/.env and restart uvicorn, or type the question."
        );
      }
      setImageAttachment((prev) =>
        prev ? { ...prev, extractedText: text } : prev
      );
      setQuestion(text);
      if (source === "tesseract" || hint) {
        pushBotMessage(
          "Basic OCR was used (less accurate). Check GROQ_API_KEY in mathvox-backend/.env, restart uvicorn, and ensure the backend is running on port 8080."
        );
      } else if (problemCount > 0 && problemCount < 8) {
        pushBotMessage(
          `Found ${problemCount} problems. If any are missing, re-upload a clearer photo or check GROQ_VISION_MODEL in .env.`
        );
      }
    } catch (err) {
      pushBotError("OCR failed", err.message || "could not read image");
      setImageAttachment((prev) =>
        prev ? { ...prev, extractedText: "" } : prev
      );
    }

    setOcrLoading(false);
    setOcrProgress(0);
  };

  const updateExtractedText = (value) => {
    setImageAttachment((prev) =>
      prev ? { ...prev, extractedText: value } : prev
    );
    setQuestion(value);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !voiceChatActive) {
      e.preventDefault();
      runSolve();
    }
  };

  const canSend = getSolveText().length > 0;
  const busy = loading || ocrLoading || dictating;

  const voicePhaseLabel =
    voicePhase === "listening"
      ? "Listening…"
      : voicePhase === "thinking"
        ? "Thinking…"
        : voicePhase === "speaking"
          ? "Speaking…"
          : "";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      syncUserProfileFromServer().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onStyleChange = (e) => {
      setReplyStyle(e.detail?.style || getReplyStylePreference());
    };
    window.addEventListener(REPLY_STYLE_EVENT, onStyleChange);
    return () => window.removeEventListener(REPLY_STYLE_EVENT, onStyleChange);
  }, []);

  const loggedIn = isLoggedIn();
  const sidebarVisible = loggedIn && (isMobile ? sidebarOpen : !sidebarCollapsed);

  return (
    <div
      className={`flex overflow-hidden bg-slate-50 dark:bg-slate-900 ${
        loggedIn ? "fixed inset-0 z-30 h-dvh w-full" : "h-[calc(100vh-57px)]"
      }`}
    >
      {loggedIn && (
        <ChatSidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          collapsed={sidebarCollapsed}
          activeThreadId={activeThreadId}
        />
      )}

      <div
        className={`relative flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden transition-[margin] duration-200 ${
          !isMobile && sidebarVisible ? "md:ml-[260px]" : ""
        }`}
      >
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center h-14 px-2 pointer-events-none">
          <div className="flex items-center min-w-0 pointer-events-auto">
            {loggedIn && (
              <SidebarToggle
                sidebarOpen={sidebarVisible}
                onClick={handleSidebarToggle}
                className="flex shrink-0"
              />
            )}
            <span className="ml-1 text-sm font-semibold text-gray-800 dark:text-gray-200 truncate hidden sm:inline">
              Math<span className="text-[#5d44f8]">Vox</span>
            </span>
          </div>
          <div className="flex items-center gap-1 pointer-events-auto ml-auto">
            <div
              className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-xs font-medium"
              role="group"
              aria-label="Reply language"
            >
              <button
                type="button"
                onClick={() => setReplyStylePreference("ur_roman")}
                className={`px-2.5 py-1.5 transition-colors ${
                  replyStyle === "ur_roman"
                    ? "bg-[#5d44f8] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                }`}
                title="Roman Urdu replies"
              >
                اردو
              </button>
              <button
                type="button"
                onClick={() => setReplyStylePreference("en")}
                className={`px-2.5 py-1.5 transition-colors ${
                  replyStyle === "en"
                    ? "bg-[#5d44f8] text-white"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                }`}
                title="English replies"
              >
                EN
              </button>
            </div>
            {loggedIn && (
              <button
                type="button"
                onClick={() => setIsDark?.(!isDark)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-lg"
                aria-label="Toggle dark mode"
              >
                {isDark ? "☀️" : "🌙"}
              </button>
            )}
          </div>
        </header>
      {voiceChatActive && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div
              className={`w-20 h-20 mx-auto rounded-full mb-4 flex items-center justify-center ${
                voicePhase === "listening"
                  ? "bg-indigo-500 animate-pulse"
                  : voicePhase === "speaking"
                    ? "bg-green-500 animate-pulse"
                    : "bg-slate-400"
              }`}
            >
              <span className="text-3xl text-white">
                {voicePhase === "speaking" ? "🔊" : "🎤"}
              </span>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {voicePhaseLabel}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              English replies · transcript in chat
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Say “explain” for steps, or ask a problem to solve
            </p>
            <button
              type="button"
              onClick={stopVoiceChat}
              className="mt-6 w-full py-3 rounded-full bg-red-500 text-white font-medium hover:bg-red-600"
            >
              End voice chat
            </button>
          </div>
        </div>
      )}

      <div
        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden chat-scroll pt-14"
      >
        <div className="max-w-3xl mx-auto w-full px-4 py-6 pb-6">

        {messages.length === 0 && !imageAttachment && (
          <div className="text-center mt-24">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Hi, I'm{" "}
              <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                MathVox
              </span>
            </h1>
            <p className="text-gray-400 mt-2">{t.where_start}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"} mt-4`}
          >
            <div
              className={`flex flex-col max-w-[85%] ${
                msg.type === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`rounded-2xl shadow text-sm md:text-base overflow-hidden ${
                  msg.type === "user"
                    ? "bg-indigo-500 text-white"
                    : "bg-white dark:bg-slate-800 border text-gray-900 dark:text-white"
                }`}
              >
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Upload"
                    className="max-h-48 w-full object-contain bg-black/10"
                  />
                )}
                <div className="px-4 py-3 whitespace-pre-wrap max-h-[min(50vh,320px)] overflow-y-auto chat-scroll">
                  {msg.viaVoice && (
                    <span className="text-xs opacity-70 block mb-1">
                      🎤 voice
                    </span>
                  )}
                  {msg.text}
                </div>
              </div>

              {msg.type === "bot" && (
                <button
                  type="button"
                  onClick={() => speakText(msg.text)}
                  className="mt-1 text-xs text-gray-400 hover:text-indigo-500"
                >
                  🔊 Listen
                </button>
              )}
            </div>
          </div>
        ))}

        {dictating && !voiceChatActive && (
          <div className="mt-4 text-sm text-indigo-600 dark:text-indigo-300">
            🎤 Dictation — speaking into text box…
          </div>
        )}

        {loading && !voiceChatActive && (
          <div className="mt-4 px-4 py-3 rounded-2xl bg-gray-200 dark:bg-slate-700 text-sm animate-pulse">
            MathVox is thinking…
          </div>
        )}

        <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 max-h-[min(48dvh,420px)] overflow-y-auto overflow-x-hidden chat-scroll px-4 pb-4 pt-2 border-t border-gray-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">

        {imageAttachment && (
          <div className="max-w-3xl mx-auto mb-2 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
            <div className="relative">
              <img
                src={imageAttachment.previewUrl}
                alt="Preview"
                className="w-full max-h-36 object-contain bg-gray-50 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={() => clearImageAttachment(true)}
                disabled={ocrLoading}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 text-white text-xl leading-none hover:bg-black/85"
                aria-label="Remove image"
              >
                ×
              </button>
              {ocrLoading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm">
                  Reading… {ocrProgress}%
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-500 mb-1">
                Extracted text (worksheets: one problem per line; long expressions stay as one block):
              </p>
              <textarea
                ref={extractedInputRef}
                value={imageAttachment.extractedText}
                onChange={(e) => updateExtractedText(e.target.value)}
                onInput={(e) => resizeTextarea(e.target, 280)}
                rows={1}
                disabled={ocrLoading}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-sm outline-none resize-none overflow-y-auto min-h-[48px] max-h-[280px]"
                style={{ height: "48px" }}
              />
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto mb-2 flex flex-wrap gap-2 text-xs text-gray-500">
          <button
            type="button"
            onClick={runExplain}
            disabled={loading || !canSend || voiceChatActive}
            className="rounded-lg border border-indigo-300 px-2 py-1 text-indigo-600 disabled:opacity-40"
          >
            Explain
          </button>
        </div>

        {/* ChatGPT-style input bar */}
        <div className="max-w-3xl mx-auto flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 shadow-xl rounded-[28px] px-2 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || ocrLoading || voiceChatActive}
            title="Upload image"
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl leading-none text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40"
          >
            +
          </button>

          <textarea
            ref={questionInputRef}
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onInput={(e) => resizeTextarea(e.target, 200)}
            onKeyDown={handleKeyPress}
            disabled={loading || voiceChatActive}
            placeholder={
              voiceChatActive ? "Voice chat active…" : "Ask anything"
            }
            className="flex-1 bg-transparent outline-none text-sm md:text-base placeholder:text-gray-400 resize-none overflow-y-auto py-2.5 min-h-[40px] max-h-[200px]"
            style={{ height: "40px" }}
          />

          {/* Voice to text (dictation) */}
          <button
            type="button"
            onClick={toggleDictation}
            disabled={loading || ocrLoading || voiceChatActive}
            title="Voice to text"
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 ${
              dictating
                ? "bg-red-100 text-red-600 animate-pulse"
                : "hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-5 9a7 7 0 007-7h-2a5 5 0 01-10 0H5a7 7 0 007 7z" />
            </svg>
          </button>

          {/* Voice conversation (like ChatGPT call) */}
          <button
            type="button"
            onClick={voiceChatActive ? stopVoiceChat : startVoiceChat}
            disabled={loading || ocrLoading}
            title="Voice chat — talk back and forth"
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              voiceChatActive
                ? "bg-indigo-500 text-white animate-pulse"
                : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M12 3a9 9 0 019 9v3a3 3 0 01-3 3h-1v-4h1a1 1 0 001-1v-3a7 7 0 10-14 0v3a1 1 0 001 1h1v4H6a3 3 0 01-3-3v-3a9 9 0 019-9z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={runSolve}
            disabled={loading || !canSend || voiceChatActive}
            title="Solve"
            className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-indigo-600"
          >
            ➤
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Chat;
