```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     ██╗  ██╗███████╗██████╗  ██████╗                  ║
║     ██║ ██╔╝██╔════╝██╔══██╗██╔═══██╗                ║
║     █████╔╝ █████╗  ██████╔╝██║   ██║                ║
║     ██╔═██╗ ██╔══╝  ██╔══██╗██║   ██║                ║
║     ██║  ██╗███████╗██║  ██║╚██████╔╝                ║
║     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝                ║
║                                                       ║
║         PERSONAL AI ASSISTANT                         ║
║         Powered by OpenHorizon                        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

# KERO — Personal AI Assistant

A production-grade, futuristic AI assistant desktop application inspired by JARVIS. Built with Express.js, Vanilla HTML/CSS/JS, and Electron — powered by the OpenHorizon LLM API.

---

## ✅ Features

- ✅ **JARVIS-inspired dark futuristic UI** with animated particle background
- ✅ **3-panel desktop layout** — sidebar, chat, quick actions
- ✅ **Secure Express backend** — API key never exposed to frontend
- ✅ **OpenHorizon LLM integration** (OpenAI-compatible endpoint)
- ✅ **Voice input** via Web Speech API
- ✅ **Text-to-speech** responses
- ✅ **Electron desktop wrapper** with custom titlebar
- ✅ **System tray** with global shortcut (Alt+K)
- ✅ **Rate limiting** (60 req/min) & Helmet security headers
- ✅ **Persistent chat history** via localStorage
- ✅ **Quick action cards** for common tasks
- ✅ **Web search mode** toggle
- ✅ **Real-time token/context tracking**
- ✅ **Animated system stats** (Neural Core, Memory, Context)
- ✅ **Responsive** — works at smaller sizes too

---

## 📁 Folder Structure

```
kero/
├── backend/
│   └── server.js          # Express API server
├── electron/
│   ├── main.js            # Electron main process
│   └── preload.js         # Context bridge for IPC
├── frontend/
│   ├── index.html         # Main UI
│   ├── style.css          # Dark futuristic theme
│   └── app.js             # Frontend logic
├── .env.example           # Environment template
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your OpenHorizon API key:

```env
OPENHORIZON_API_KEY=your-actual-key-here
OPENHORIZON_BASE_URL=https://api.openhorizon.so/v1
OPENHORIZON_MODEL=gpt-oss-20b
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
```

### 3. Run

**Browser mode** (backend + frontend):
```bash
npm start
```
Then open http://localhost:3000

**Electron desktop mode**:
```bash
npm run electron
```

**Backend only**:
```bash
npm run backend
```

---

## 🏗️ Architecture

```
┌──────────────┐     HTTP      ┌──────────────────┐    HTTPS     ┌───────────────┐
│              │   REST API    │                  │   API Call   │               │
│   Frontend   │◄────────────►│  Express Server  │◄───────────►│  OpenHorizon  │
│  (Browser /  │  localhost    │   (Port 4000)    │  Bearer Auth │  LLM API      │
│  Electron)   │    :3000      │                  │              │               │
│              │               │  • CORS locked   │              │  • GPT-oss-20b│
│  • Chat UI   │               │  • Rate limited  │              │  • Chat API   │
│  • Voice I/O │               │  • Helmet        │              │               │
│  • TTS       │               │  • .env secrets  │              │               │
└──────────────┘               └──────────────────┘              └───────────────┘

┌──────────────┐
│   Electron   │  Wraps the frontend in a native desktop window
│   Shell      │  • Custom titlebar  • System tray  • Alt+K shortcut
└──────────────┘
```

---

## 🎨 Customisation

### Change the AI model

Edit `.env`:
```env
OPENHORIZON_MODEL=your-preferred-model
```

### Change the personality

Edit the `SYSTEM_PROMPT` in `backend/server.js`:
```js
const SYSTEM_PROMPT = {
  role: 'system',
  content: 'Your custom personality here...'
};
```

### Change the global shortcut

Edit `electron/main.js`:
```js
globalShortcut.register('Alt+K', () => { ... });
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|---------|
| **Backend won't start** | Check `.env` exists and has valid values. Run `node backend/server.js` to see errors. |
| **"BACKEND ✗" in UI** | Backend isn't running. Run `npm run backend` first. |
| **"KEY MISSING" warning** | Add your API key to `.env`. Don't use the placeholder value. |
| **Voice input not working** | Use Chrome or Edge. Firefox doesn't support Web Speech API. |
| **Electron window blank** | Make sure frontend is running on port 3000 before Electron starts. |
| **Rate limit errors** | Wait 60 seconds. Limit is 60 requests per minute. |

---

## 🔮 What to Build Next

- [ ] **Streaming responses** — real-time token-by-token display
- [ ] **Markdown rendering** — render code blocks, lists, bold/italic
- [ ] **File upload** — analyze documents and images
- [ ] **Conversation export** — save chats as PDF or Markdown
- [ ] **Multiple personas** — switch between assistant styles
- [ ] **Plugin system** — extend with custom tools
- [ ] **Auto-updater** — Electron auto-update via GitHub releases
- [ ] **Themes** — switch between color schemes

---

## 📜 License

MIT — use freely, modify endlessly.

# kero-ai