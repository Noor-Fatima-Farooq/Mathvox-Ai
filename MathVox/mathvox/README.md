# MathVox (React + Vite)

Math tutoring UI with client-side OCR, SymPy solving, and optional LLM step-by-step explanations (Groq, Gemini, or Ollama).

## Run frontend

```bash
cd MathVox/MathVox/mathvox
npm install
npm run dev
```

## Run backend

```bash
cd mathvox-backend
pip install -r requirements.txt
# Explain only — copy .env.example to .env and set GROQ_API_KEY (free)
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API default: `http://127.0.0.1:8080` (match `src/services/api.js` BASE_URL)

## Features

| Feature | Where |
|--------|--------|
| **OCR** | Browser only ([Tesseract.js](https://tesseract.projectnaptha.com/)) — upload image in chat, edit extracted text, then Solve |
| **Solve** | `POST /solve` — SymPy (`app/services/solver.py`) |
| **Explain** | `POST /explain` — LLM text-only (Groq / Gemini / Ollama) |

LLM is used only for `/explain` (chat bubble text). No image bytes sent. OCR stays in the browser.

**Roman Urdu** (`reply_style: ur_roman`) affects only explanation text in chat, not navbar UI.

## Explain providers (backend `.env`)

| Provider | Cost | Setup |
|----------|------|--------|
| **groq** (default) | Free tier | [console.groq.com/keys](https://console.groq.com/keys) → `GROQ_API_KEY` |
| **gemini** | Free tier (limits) | `LLM_PROVIDER=gemini` + `GEMINI_API_KEY` |
| **ollama** | Free, local | Install [ollama.com](https://ollama.com), `ollama pull llama3.2`, `LLM_PROVIDER=ollama` |

Example `.env` in `mathvox-backend/`:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here
```

Restart the backend after changing `.env`.
