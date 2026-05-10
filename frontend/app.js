/* ═══════════════════════════════════════════
   KERO — Minimal Realistic UI Logic
   ═══════════════════════════════════════════ */

let history = [];
let busy = false;
const API = 'http://localhost:4000/api';

const $ = (id) => document.getElementById(id);
const chatArea = $('chatArea');
const chatInput = $('chatInput');
const sendBtn = $('sendBtn');
const backendStatus = $('backendStatus');
const modelName = $('modelName');

document.addEventListener('DOMContentLoaded', () => {
  // Load saved history
  try {
    const saved = localStorage.getItem('kero_history_v2');
    if (saved) {
      history = JSON.parse(saved);
      if (history.length > 0) {
        const welcome = $('welcomeScreen');
        if (welcome) welcome.remove();
        history.forEach(m => addMsg(m.role, m.content));
      }
    }
  } catch (e) {}

  checkBackend();

  // Electron Titlebar
  if (window.electronAPI?.isElectron) {
    const titlebar = $('titlebar');
    const shell = $('appShell');
    if(titlebar) titlebar.classList.add('visible');
    if(shell) shell.classList.add('with-titlebar');

    $('tbClose')?.addEventListener('click', () => window.electronAPI.close());
    $('tbMin')?.addEventListener('click', () => window.electronAPI.minimize());
    $('tbMax')?.addEventListener('click', () => window.electronAPI.maximize());
  }

  // Enter to send
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  });
});

async function checkBackend() {
  try {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    
    backendStatus.classList.remove('offline');
    backendStatus.classList.add('online');
    backendStatus.querySelector('.text').textContent = 'Online';
    if(data.model) modelName.textContent = data.model;
    
  } catch (err) {
    backendStatus.classList.remove('online');
    backendStatus.classList.add('offline');
    backendStatus.querySelector('.text').textContent = 'Offline';
  }
}

async function sendMsg() {
  const text = chatInput.value.trim();
  if (!text || busy) return;

  busy = true;
  sendBtn.disabled = true;
  chatInput.value = '';

  addMsg('user', text);
  history.push({ role: 'user', content: text });
  saveHistory();

  // Thinking indicator
  const thinkDiv = addThinking();

  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    });

    thinkDiv.remove();

    if (!res.ok) {
      const errData = await res.json().catch(()=>({}));
      addMsg('assistant', `⚠️ Error: ${errData.error || 'Server unreachable.'}`);
    } else {
      const data = await res.json();
      addMsg('assistant', data.reply);
      history.push({ role: 'assistant', content: data.reply });
      saveHistory();
    }
  } catch (err) {
    thinkDiv.remove();
    addMsg('assistant', '⚠️ Failed to connect to backend.');
  }

  busy = false;
  sendBtn.disabled = false;
  chatInput.focus();
}

function quickAction(prompt) {
  chatInput.value = prompt;
  chatInput.focus();
}

function clearMem() {
  history = [];
  localStorage.removeItem('kero_history_v2');
  
  // Reset UI
  chatArea.innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <h1 class="welcome-title">Hello there!</h1>
      <p class="welcome-subtitle">How can I help you today?</p>
      <div class="suggestion-cards">
        <div class="suggestion-card" onclick="quickAction('Open Calculator')">
          <div class="card-title">Open Calculator</div>
          <div class="card-desc">to do some math</div>
        </div>
        <div class="suggestion-card" onclick="quickAction('Read the package.json file')">
          <div class="card-title">Read project files</div>
          <div class="card-desc">like package.json</div>
        </div>
      </div>
    </div>
  `;
}

function addMsg(role, text) {
  const welcome = $('welcomeScreen');
  if (welcome) welcome.remove();

  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${role}`;

  const avatarLabel = role === 'assistant' ? 
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' : 
    'You';

  wrapper.innerHTML = `
    <div class="avatar">${avatarLabel}</div>
    <div class="message-content">${escHtml(text)}</div>
  `;

  chatArea.appendChild(wrapper);
  chatArea.scrollTop = chatArea.scrollHeight;
  return wrapper;
}

function addThinking() {
  const welcome = $('welcomeScreen');
  if (welcome) welcome.remove();

  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper assistant`;
  wrapper.innerHTML = `
    <div class="avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
    <div class="message-content">
      <div class="tool-status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
        Thinking...
      </div>
    </div>
  `;

  chatArea.appendChild(wrapper);
  chatArea.scrollTop = chatArea.scrollHeight;
  return wrapper;
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function saveHistory() {
  try {
    localStorage.setItem('kero_history_v2', JSON.stringify(history));
  } catch (e) {}
}
