/* ═══════════════════════════════════════════
   KERO — Backend Server
   Express.js + Google Gemini API
   ═══════════════════════════════════════════ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();

/* ── Environment ── */
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.GEMINI_API_KEY || '';
const BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

/* ── System Prompt ── */
const SYSTEM_PROMPT = {
  role: 'system',
  content:
    `You are Kero — a highly intelligent, precise personal AI assistant. ` +
    `You are sharp, slightly formal but warm, occasionally witty. ` +
    `You give complete answers without padding or filler. ` +
    `Address the user as 'sir' or 'ma'am' occasionally. ` +
    `You are running locally on the user's machine via Google Gemini inference.`
};

/* ── Middleware ── */
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use('/api/', limiter);

/* ── Routes ── */

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    apiKeyLoaded: API_KEY.length > 0 && API_KEY !== 'your-gemini-api-key-here',
    model: MODEL,
    timestamp: new Date().toISOString()
  });
});

// Chat completions
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, useSearch } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required and must not be empty.' });
    }

    if (!API_KEY || API_KEY === 'your-gemini-api-key-here') {
      return res.status(401).json({ error: 'API key is not configured on the server.' });
    }

    // Build messages array with system prompt
    const fullMessages = [SYSTEM_PROMPT, ...messages];

    // If search mode, prepend a hint to the last user message
    if (useSearch) {
      const last = fullMessages[fullMessages.length - 1];
      if (last && last.role === 'user') {
        last.content = `[Web search mode enabled] ${last.content}`;
      }
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: fullMessages,
        max_tokens: 1024,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[Kero] Upstream error ${response.status}: ${errBody}`);

      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ error: 'Invalid or expired API key.' });
      }
      return res.status(502).json({ error: 'Upstream AI service returned an error. Please try again.' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'I received an empty response. Please try again.';
    const usage = data.usage || null;

    res.json({ reply, usage });
  } catch (err) {
    console.error('[Kero] Chat error:', err.message);
    res.status(502).json({ error: 'Failed to reach the AI service. Check your connection and API configuration.' });
  }
});

// Clear memory (stateless acknowledgment)
app.post('/api/clear', (_req, res) => {
  res.json({ cleared: true });
});

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   KERO Backend — Port ${PORT}            ║`);
  console.log(`  ║   Model: ${MODEL.padEnd(25)}  ║`);
  console.log(`  ║   API Key: ${API_KEY ? '✓ Loaded' : '✗ Missing'}                  ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
