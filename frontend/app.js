/* ═══════════════════════════════════════════
   KERO — Frontend Application Logic
   ═══════════════════════════════════════════ */

/* ── State ── */
let history = [];
let msgCount = 0;
let busy = false;
let listening = false;
let recognition = null;
let currentMode = 'chat';

const API = 'http://localhost:4000/api';

/* ── DOM refs ── */
const $ = (id) => document.getElementById(id);
const chatArea     = $('chatArea');
const chatInput    = $('chatInput');
const sendBtn      = $('sendBtn');
const orbBtn       = $('orbBtn');
const orbIcon      = $('orbIcon');
const voiceWaves   = $('voiceWaves');
const welcomeScreen = $('welcomeScreen');
const pillBackend  = $('pillBackend');
const pillModel    = $('pillModel');
const pillCount    = $('pillCount');
const backendDot   = $('backendDot');
const backendText  = $('backendText');
const ctxFill      = $('ctxFill');
const ctxCount     = $('ctxCount');
const statCpu      = $('statCpu');
const statMem      = $('statMem');
const statCtx      = $('statCtx');
const fillCpu      = $('fillCpu');
const fillMem      = $('fillMem');
const fillCtx      = $('fillCtx');
const titlebar     = $('titlebar');
const appShell     = $('appShell');

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Load saved history
  try {
    const saved = localStorage.getItem('kero_history');
    if (saved) {
      history = JSON.parse(saved);
      msgCount = history.filter(m => m.role === 'user').length;
      // Rebuild bubbles from saved history
      history.forEach(m => addMsg(m.role, m.content));
      updateContext();
      updateMsgCount();
    }
  } catch (e) {
    console.warn('Could not load history:', e);
  }

  initCanvas();
  animStats();
  checkBackend();

  // Electron detection
  if (window.electronAPI?.isElectron) {
    titlebar.classList.add('visible');
    appShell.classList.add('with-titlebar');

    $('tbClose').addEventListener('click', () => window.electronAPI.close());
    $('tbMin').addEventListener('click', () => window.electronAPI.minimize());
    $('tbMax').addEventListener('click', () => window.electronAPI.maximize());
  }

  // Enter to send
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  });
});

/* ═══════════════════════════════════════════
   BACKEND HEALTH CHECK
   ═══════════════════════════════════════════ */
async function checkBackend() {
  try {
    const res = await fetch(`${API}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    const data = await res.json();

    // Update backend pill
    pillBackend.innerHTML = '<span class="pill-dot dot-green"></span>BACKEND ✓';
    pillBackend.style.borderColor = 'rgba(74,222,128,0.2)';
    pillModel.textContent = data.model || 'unknown';

    // Update sidebar status
    if (data.apiKeyLoaded) {
      backendDot.className = 'status-dot loaded';
      backendText.className = 'status-text online';
      backendText.textContent = '⬤ API KEY LOADED';
      // Only add welcome if no history
      if (history.length === 0) {
        addMsg('assistant', 'Systems online, sir. All cores nominal. How may I assist you today?');
      }
    } else {
      backendDot.className = 'status-dot';
      backendDot.style.background = 'var(--amber)';
      backendText.className = 'status-text';
      backendText.style.color = 'var(--amber)';
      backendText.textContent = '⬤ KEY MISSING';
      if (history.length === 0) {
        addMsg('assistant', '⚠️ Backend is running, but no API key is configured. Please add your OpenHorizon key to the .env file and restart the server.');
      }
    }
  } catch (err) {
    pillBackend.innerHTML = '<span class="pill-dot dot-red"></span>BACKEND ✗';
    pillBackend.style.borderColor = 'rgba(244,63,94,0.2)';

    backendDot.className = 'status-dot offline';
    backendText.className = 'status-text offline';
    backendText.textContent = '⬤ OFFLINE';

    if (history.length === 0) {
      addMsg('assistant',
        '🔴 Cannot reach backend at localhost:4000.\n\n' +
        'To start the server:\n' +
        '1. Open a terminal in the project folder\n' +
        '2. Run: npm run backend\n' +
        '3. Or run: npm start (starts both backend + frontend)\n\n' +
        'Make sure your .env file has a valid API key.'
      );
    }
  }
}

/* ═══════════════════════════════════════════
   SEND MESSAGE
   ═══════════════════════════════════════════ */
async function sendMsg() {
  const text = chatInput.value.trim();
  if (!text || busy) return;

  busy = true;
  sendBtn.disabled = true;
  orbBtn.disabled = true;
  chatInput.value = '';

  // Add user bubble
  addMsg('user', text);
  history.push({ role: 'user', content: text });
  msgCount++;
  updateMsgCount();
  saveHistory();
  updateContext();

  // Show thinking
  const thinkDiv = addMsg('assistant', '', true);

  // Determine search mode
  const useSearch = currentMode === 'search' ||
    /search|latest|today|current|news|weather|price|who is|what is happening/i.test(text);

  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, useSearch })
    });

    const data = await res.json();

    // Remove thinking
    if (thinkDiv && thinkDiv.parentNode) thinkDiv.remove();

    if (!res.ok) {
      addMsg('assistant', `⚠️ ${data.error || 'Something went wrong. Please try again.'}`);
    } else {
      addMsg('assistant', data.reply);
      history.push({ role: 'assistant', content: data.reply });
      saveHistory();
      updateContext();
      speak(data.reply);
    }
  } catch (err) {
    if (thinkDiv && thinkDiv.parentNode) thinkDiv.remove();
    addMsg('assistant', '⚠️ Failed to connect to the backend. Make sure the server is running.');
  }

  busy = false;
  sendBtn.disabled = false;
  orbBtn.disabled = false;
  chatInput.focus();
}

/* ═══════════════════════════════════════════
   QUICK ACTION
   ═══════════════════════════════════════════ */
function quickAction(prompt) {
  chatInput.value = prompt;
  chatInput.focus();
}

/* ═══════════════════════════════════════════
   VOICE INPUT
   ═══════════════════════════════════════════ */
function toggleVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    addMsg('assistant', '🎤 Speech recognition is not supported in this browser. Please use Chrome for voice input.');
    return;
  }

  if (listening) {
    if (recognition) recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    orbBtn.classList.add('listening');
    orbIcon.textContent = '🔴';
    voiceWaves.classList.add('active');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    sendMsg();
  };

  recognition.onerror = (event) => {
    console.error('Speech error:', event.error);
    if (event.error !== 'aborted') {
      addMsg('assistant', `🎤 Voice error: ${event.error}. Please try again.`);
    }
  };

  recognition.onend = () => {
    listening = false;
    orbBtn.classList.remove('listening');
    orbIcon.textContent = '🎤';
    voiceWaves.classList.remove('active');
  };

  recognition.start();
}

/* ═══════════════════════════════════════════
   TEXT-TO-SPEECH
   ═══════════════════════════════════════════ */
function speak(text) {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(text.substring(0, 450));
  utt.rate = 0.94;
  utt.pitch = 0.88;
  utt.volume = 0.82;

  // Prefer a good English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Google') && v.lang.startsWith('en')
  ) || voices.find(v =>
    v.name.includes('Daniel')
  ) || voices.find(v =>
    v.lang.startsWith('en')
  );
  if (preferred) utt.voice = preferred;

  window.speechSynthesis.speak(utt);
}

// Preload voices
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

/* ═══════════════════════════════════════════
   CLEAR MEMORY
   ═══════════════════════════════════════════ */
function clearMem() {
  history = [];
  msgCount = 0;
  localStorage.removeItem('kero_history');

  // Clear chat area and restore welcome screen
  chatArea.innerHTML = '';
  const w = document.createElement('div');
  w.className = 'welcome';
  w.id = 'welcomeScreen';
  w.innerHTML = `
    <div class="welcome-title">KERO</div>
    <div class="welcome-sub">PERSONAL AI ASSISTANT</div>
    <div class="welcome-hint">CLICK THE ORB OR TYPE TO BEGIN</div>
  `;
  chatArea.appendChild(w);

  updateMsgCount();
  updateContext();

  // Notify backend (stateless)
  fetch(`${API}/clear`, { method: 'POST' }).catch(() => {});
}

/* ═══════════════════════════════════════════
   NAV CLICK
   ═══════════════════════════════════════════ */
function navClick(el, mode) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  currentMode = mode;

  if (mode === 'memory') {
    addMsg('assistant', `📝 Memory status: ${history.length} messages stored locally.\n\nYour conversation history is saved in the browser's localStorage and persists between sessions. Use the "Clear Memory" button to erase it.`);
  }

  if (mode === 'search') {
    addMsg('assistant', '🌐 Web search mode activated. Your next queries will be enhanced with search capabilities.');
  }
}

/* ═══════════════════════════════════════════
   ADD MESSAGE BUBBLE
   ═══════════════════════════════════════════ */
function addMsg(role, text, isThinking) {
  // Remove welcome screen on first message
  const welcome = document.getElementById('welcomeScreen');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const avatarLabel = role === 'assistant' ? 'K' : 'YOU';
  const now = new Date();
  const ts = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let bubbleContent;
  if (isThinking) {
    bubbleContent = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;
  } else {
    bubbleContent = escHtml(text);
  }

  div.innerHTML = `
    <div class="msg-avatar">${avatarLabel}</div>
    <div class="msg-body">
      <div class="msg-bubble">${bubbleContent}</div>
      ${isThinking ? '' : `<div class="msg-time">${ts}</div>`}
    </div>
  `;

  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;

  return div;
}

/* ═══════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════ */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

function saveHistory() {
  try {
    localStorage.setItem('kero_history', JSON.stringify(history));
  } catch (e) {
    console.warn('Could not save history:', e);
  }
}

function updateMsgCount() {
  pillCount.textContent = `${msgCount} msgs`;
}

function updateContext() {
  const totalChars = history.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  const approxTokens = Math.round(totalChars / 4);
  const maxTokens = 128000;
  const pct = Math.min((approxTokens / maxTokens) * 100, 100);

  ctxFill.style.width = pct + '%';
  ctxCount.textContent = `${approxTokens.toLocaleString()} / 128K tokens`;

  // Update sidebar context stat
  statCtx.textContent = pct.toFixed(1) + '%';
  fillCtx.style.width = pct + '%';
}

/* ═══════════════════════════════════════════
   ANIMATED SYSTEM STATS
   ═══════════════════════════════════════════ */
function animStats() {
  const cpuValues = [62, 58, 71, 44, 67, 84, 53, 76, 48, 63, 72, 55];
  const memValues = [38, 41, 35, 43, 37, 45, 39, 42, 36, 40, 44, 38];
  let idx = 0;

  setInterval(() => {
    const cpu = cpuValues[idx % cpuValues.length];
    const mem = memValues[idx % memValues.length];
    idx++;

    statCpu.textContent = cpu + '%';
    fillCpu.style.width = cpu + '%';
    statMem.textContent = mem + '%';
    fillMem.style.width = mem + '%';
  }, 2200);
}

/* ═══════════════════════════════════════════
   ANIMATED BACKGROUND CANVAS
   ═══════════════════════════════════════════ */
function initCanvas() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Particles
  const PARTICLE_COUNT = 55;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(56,189,248,0.025)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 55) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 55) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Update & draw particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56,189,248,0.45)';
      ctx.fill();
    }

    // Connection lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 75) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(56,189,248,${0.12 * (1 - dist / 75)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
}
