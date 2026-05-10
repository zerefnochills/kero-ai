/* ═══════════════════════════════════════════
   KERO — Backend Server with Tool Calling
   ═══════════════════════════════════════════ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const { exec } = require('child_process');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.GEMINI_API_KEY || 'ollama';
const BASE_URL = process.env.GEMINI_BASE_URL || 'http://localhost:11434/v1';
const MODEL = process.env.GEMINI_MODEL || 'llama3';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are Kero, a highly capable local AI assistant. 
You are running on the user's local machine and have tools to interact with their system.
Use the 'open_application' tool to launch apps (e.g. 'notepad', 'calc', or paths).
Use the 'list_directory' tool to see files in a folder.
Use the 'read_file' tool to read file contents.
Do not ask for permission to use tools, just use them when requested.`
};

// Define Tools
const tools = [
  {
    type: "function",
    function: {
      name: "open_application",
      description: "Opens an application or file on the Windows machine. e.g. 'notepad', 'calc', 'explorer', or an absolute path.",
      parameters: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "The name of the app to launch (e.g. 'calc', 'notepad')"
          }
        },
        required: ["app_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "Lists the contents of a directory on the local machine.",
      parameters: {
        type: "object",
        properties: {
          dir_path: {
            type: "string",
            description: "The absolute path of the directory to list, or '.' for the current project root."
          }
        },
        required: ["dir_path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Reads the content of a local file.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "The absolute or relative path of the file to read."
          }
        },
        required: ["file_path"]
      }
    }
  }
];

// Tool Implementation Logic
async function executeTool(toolCall) {
  const funcName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);
  
  try {
    if (funcName === 'open_application') {
      return await new Promise((resolve) => {
        // use 'start' on windows to open apps
        exec(`start "" "${args.app_name}"`, (error) => {
          if (error) resolve(`Failed to open application: ${error.message}`);
          else resolve(`Successfully launched ${args.app_name}`);
        });
      });
    } 
    else if (funcName === 'list_directory') {
      let p = args.dir_path === '.' ? process.cwd() : args.dir_path;
      const files = await fs.readdir(p);
      return `Contents of ${p}:\n` + files.join('\n');
    }
    else if (funcName === 'read_file') {
      let p = path.resolve(process.cwd(), args.file_path);
      const content = await fs.readFile(p, 'utf8');
      return content.substring(0, 4000); // return up to 4000 chars to avoid blowing up context
    }
  } catch (error) {
    return `Error executing ${funcName}: ${error.message}`;
  }
  return `Unknown tool: ${funcName}`;
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

// Chat completion with tool loop
app.post('/api/chat', async (req, res) => {
  try {
    let { messages } = req.body;
    if (!messages) return res.status(400).json({ error: 'messages missing' });

    // Always start with system prompt
    let fullMessages = [SYSTEM_PROMPT, ...messages];

    let finalReply = "";
    
    // Up to 3 iterations for tool calls
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: fullMessages,
          tools: tools,
          stream: false
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`Upstream error:`, errBody);
        return res.status(502).json({ error: 'Upstream AI service error.' });
      }

      const data = await response.json();
      const choice = data.choices[0];
      const message = choice.message;

      // Append assistant's message (which might contain tool_calls)
      fullMessages.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        // Execute all tool calls
        for (const call of message.tool_calls) {
          const resultContent = await executeTool(call);
          
          fullMessages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: resultContent
          });
        }
        // Loop continues to let model process tool results
      } else {
        // No tool calls, we have the final response
        finalReply = message.content;
        break;
      }
    }

    res.json({ reply: finalReply || "Task completed." });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(502).json({ error: 'Failed to reach AI service.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  KERO Backend (Ollama/Tool Calling) — Port ${PORT}`);
  console.log(`  Model: ${MODEL} | Base URL: ${BASE_URL}\n`);
});
