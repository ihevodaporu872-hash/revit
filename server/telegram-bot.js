// ============================================================================
// Jens Platform — Telegram Bot
// ============================================================================
// Bot: @jenssssssssss_bot (Jens Platform)
// Run:  node server/telegram-bot.js
// ============================================================================

import TelegramBot from 'node-telegram-bot-api'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not set in .env')
  process.exit(1)
}

const BACKEND_URL = `http://localhost:${process.env.PORT || 3001}`
const N8N_URL = process.env.N8N_URL || 'http://localhost:5678'

const bot = new TelegramBot(TOKEN, { polling: true })
const PROJECT_ROOT = path.resolve(__dirname, '..')

// ─── Supabase Client ──────────────────────────────────────────────────────
let supabase = null
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  console.log('[TgBot] Supabase client initialized')
} else {
  console.warn('[TgBot] WARNING: Supabase credentials not set — message storage disabled')
}

// ─── Gemini AI ────────────────────────────────────────────────────────────
let geminiModel = null
if (process.env.GOOGLE_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  console.log('[TgBot] Gemini AI initialized (gemini-2.0-flash)')
} else {
  console.warn('[TgBot] WARNING: GOOGLE_API_KEY not set — /tovbin disabled')
}

console.log('='.repeat(50))
console.log('  Jens Platform — Telegram Bot')
console.log('  Bot: @jenssssssssss_bot')
console.log('  Mode: polling')
console.log(`  Backend: ${BACKEND_URL}`)
console.log(`  n8n: ${N8N_URL}`)
console.log('='.repeat(50))

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function safeFetch(url, options = {}) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch {
    return null
  }
}

function send(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Message Storage ──────────────────────────────────────────────────────

async function ensureChatExists(chat) {
  if (!supabase) return
  try {
    await supabase.from('telegram_chats').upsert({
      id: chat.id,
      chat_type: chat.type,
      title: chat.title || null,
      username: chat.username || null,
      first_name: chat.first_name || null,
      last_name: chat.last_name || null,
    }, { onConflict: 'id', ignoreDuplicates: false })
  } catch (err) {
    console.error('[TgBot] ensureChatExists error:', err.message)
  }
}

async function saveMessage(msg, messageType, extra = {}) {
  if (!supabase) return
  try {
    await ensureChatExists(msg.chat)

    const row = {
      telegram_message_id: msg.message_id,
      chat_id: msg.chat.id,
      from_user_id: msg.from?.id || null,
      from_username: msg.from?.username || null,
      from_first_name: msg.from?.first_name || null,
      message_type: messageType,
      text_content: extra.text_content || msg.text || msg.caption || null,
      file_path: extra.file_path || null,
      file_name: extra.file_name || null,
      file_size: extra.file_size || null,
      mime_type: extra.mime_type || null,
      telegram_file_id: extra.telegram_file_id || null,
      reply_to_message_id: msg.reply_to_message?.message_id || null,
      forward_from: msg.forward_from ? (msg.forward_from.username || msg.forward_from.first_name) : null,
      telegram_date: new Date(msg.date * 1000).toISOString(),
    }

    await supabase.from('telegram_messages').upsert(row, {
      onConflict: 'chat_id,telegram_message_id',
      ignoreDuplicates: false,
    })

    // Update chat last_message_at
    await supabase.from('telegram_chats').update({
      last_message_at: row.telegram_date,
    }).eq('id', msg.chat.id)
  } catch (err) {
    console.error('[TgBot] saveMessage error:', err.message)
  }
}

async function downloadAndSave(msg, fileId, subdir) {
  try {
    const chatDir = path.join(PROJECT_ROOT, 'uploads', 'telegram', String(msg.chat.id), subdir)
    await fs.mkdir(chatDir, { recursive: true })

    const filePath = await bot.downloadFile(fileId, chatDir)
    // filePath is absolute path returned by the library
    const relativePath = path.relative(PROJECT_ROOT, filePath)
    return relativePath
  } catch (err) {
    console.error('[TgBot] downloadAndSave error:', err.message)
    return null
  }
}

// ─── /start ──────────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'there'
  send(msg.chat.id, `<b>Welcome to Jens Platform, ${name}!</b> \u{1F3D7}

I'm your construction management assistant. Here's what I can do:

\u{1F4CA} <b>Status &amp; Monitoring</b>
/status \u2014 Platform &amp; n8n status
/health \u2014 Full system health check
/workflows \u2014 List all n8n workflows

\u{1F4B0} <b>Cost Estimation</b>
/estimate \u2014 Quick cost estimate via CWICR database

\u{1F4CB} <b>Project Management</b>
/tasks \u2014 View current project tasks

\u{1F504} <b>CAD Conversion</b>
/convert \u2014 CAD file conversion info

\u{1F50D} <b>AI Search</b>
/tovbin &lt;question&gt; \u2014 Search chat history with AI

Type /help to see all commands.`)
})

// ─── /help ───────────────────────────────────────────────────────────────────

bot.onText(/\/help/, (msg) => {
  send(msg.chat.id, `<b>Jens Platform Bot \u2014 Commands</b> \u{1F4D6}

/start \u2014 Welcome message
/help \u2014 This help menu
/status \u2014 n8n &amp; platform status
/workflows \u2014 List all n8n workflows
/estimate &lt;query&gt; \u2014 Cost estimate (e.g. /estimate concrete wall)
/tasks \u2014 View project tasks
/convert \u2014 CAD conversion info
/health \u2014 System health check
/tovbin &lt;question&gt; \u2014 AI search in chat history

<b>Examples:</b>
\u2022 <code>/estimate reinforced concrete foundation</code>
\u2022 <code>/tovbin what did we discuss about concrete?</code>
\u2022 <code>/tasks</code>
\u2022 <code>/workflows</code>

<b>Jens Platform</b> \u2014 Unified Construction Management`)
})

// ─── /status ─────────────────────────────────────────────────────────────────

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id
  bot.sendChatAction(chatId, 'typing')

  const backendRes = await safeFetch(`${BACKEND_URL}/api/health`)
  const backendOk = backendRes?.ok || false

  const n8nRes = await safeFetch(`${N8N_URL}/healthz`)
  const n8nOk = n8nRes?.ok || false

  let wfCount = '?'
  let activeCount = '?'
  if (n8nOk) {
    try {
      const wfRes = await safeFetch(`${N8N_URL}/api/v1/workflows`)
      if (wfRes?.ok) {
        const data = await wfRes.json()
        const wfs = data.data || data || []
        wfCount = wfs.length
        activeCount = wfs.filter(w => w.active).length
      }
    } catch { /* */ }
  }

  send(chatId, `<b>Jens Platform Status</b> \u{1F4CA}

<b>Backend (Express):</b> ${backendOk ? '\u2705 Online' : '\u274C Offline'}
<b>n8n Engine:</b> ${n8nOk ? '\u2705 Online' : '\u274C Offline'}
<b>Workflows:</b> ${wfCount} total, ${activeCount} active

<b>URLs:</b>
Backend: <code>${BACKEND_URL}</code>
n8n: <code>${N8N_URL}</code>`)
})

// ─── /workflows ──────────────────────────────────────────────────────────────

bot.onText(/\/workflows/, async (msg) => {
  const chatId = msg.chat.id
  bot.sendChatAction(chatId, 'typing')

  const n8nRes = await safeFetch(`${N8N_URL}/api/v1/workflows`)
  if (!n8nRes?.ok) {
    send(chatId, '\u274C Cannot reach n8n. Make sure it is running.')
    return
  }

  let data
  try {
    data = await n8nRes.json()
  } catch {
    send(chatId, '\u274C Invalid response from n8n')
    return
  }

  const workflows = data.data || data || []
  if (workflows.length === 0) {
    send(chatId, 'No workflows found in n8n.')
    return
  }

  let text = `<b>n8n Workflows</b> (${workflows.length})\n\n`
  for (const wf of workflows) {
    const icon = wf.active ? '\u{1F7E2}' : '\u26AA'
    const status = wf.active ? 'Active' : 'Inactive'
    text += `${icon} <b>${wf.name || wf.id}</b>\n`
    text += `   ID: <code>${wf.id}</code> \u2014 ${status}\n\n`
  }

  send(chatId, text.trim())
})

// ─── /estimate ───────────────────────────────────────────────────────────────

bot.onText(/\/estimate(.*)/, async (msg, match) => {
  const chatId = msg.chat.id
  const query = (match[1] || '').trim()

  if (!query) {
    send(chatId, `<b>Cost Estimate</b> \u{1F4B0}

Send a description of the construction work to estimate:

<code>/estimate reinforced concrete foundation</code>
<code>/estimate interior wall plastering</code>
<code>/estimate steel beam installation</code>

I'll search the CWICR database and return matching work items with prices.`)
    return
  }

  bot.sendChatAction(chatId, 'typing')

  const backendRes = await safeFetch(`${BACKEND_URL}/api/cost/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, language: 'EN' }),
  })

  if (!backendRes?.ok) {
    send(chatId, '\u274C Backend is offline. Start it with <code>npm run server</code>')
    return
  }

  let items
  try {
    items = await backendRes.json()
  } catch {
    send(chatId, '\u274C Invalid response from backend')
    return
  }

  if (!items || items.length === 0) {
    send(chatId, `No matching work items found for: "${query}"`)
    return
  }

  let text = `<b>Cost Estimate Results</b> \u{1F4B0}\nQuery: <i>${query}</i>\n\n`

  const top = items.slice(0, 5)
  for (const item of top) {
    const price = typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2) : '?'
    text += `\u{1F4CC} <b>${item.code || '?'}</b>\n`
    text += `   ${item.description || 'No description'}\n`
    text += `   \u{1F4B6} ${price} EUR / ${item.unit || 'unit'}\n\n`
  }

  if (items.length > 5) {
    text += `<i>... and ${items.length - 5} more results</i>\n`
  }

  send(chatId, text.trim())
})

// ─── /tasks ──────────────────────────────────────────────────────────────────

bot.onText(/\/tasks/, async (msg) => {
  const chatId = msg.chat.id
  bot.sendChatAction(chatId, 'typing')

  const backendRes = await safeFetch(`${BACKEND_URL}/api/tasks`)
  if (!backendRes?.ok) {
    send(chatId, '\u274C Backend is offline. Start it with <code>npm run server</code>')
    return
  }

  let tasks
  try {
    tasks = await backendRes.json()
  } catch {
    send(chatId, '\u274C Invalid response from backend')
    return
  }

  if (!tasks || tasks.length === 0) {
    send(chatId, 'No tasks found.')
    return
  }

  const statusIcons = {
    'todo': '\u{1F4CB}',
    'in-progress': '\u{1F504}',
    'review': '\u{1F440}',
    'done': '\u2705',
  }

  const priorityIcons = {
    'critical': '\u{1F534}',
    'high': '\u{1F7E0}',
    'medium': '\u{1F7E1}',
    'low': '\u{1F7E2}',
  }

  let text = `<b>Project Tasks</b> (${tasks.length})\n\n`

  for (const task of tasks) {
    const sIcon = statusIcons[task.status] || '\u{1F4CB}'
    const pIcon = priorityIcons[task.priority] || '\u26AA'
    text += `${sIcon} <b>${task.title}</b>\n`
    text += `   ${pIcon} ${task.priority || '?'} \u2014 ${task.status || '?'}\n`
    if (task.assignee) text += `   \u{1F464} ${task.assignee}\n`
    text += `\n`
  }

  send(chatId, text.trim())
})

// ─── /convert ────────────────────────────────────────────────────────────────

bot.onText(/\/convert/, (msg) => {
  send(msg.chat.id, `<b>CAD File Conversion</b> \u{1F504}

Jens Platform supports conversion of:
\u2022 .rvt (Revit) \u2192 IFC, XLSX, DAE
\u2022 .dwg \u2192 DXF viewer
\u2022 .dgn \u2192 IFC
\u2022 .dxf \u2192 IFC

<b>How to convert:</b>
1. Open Jens Platform in browser
2. Go to CAD Converter module
3. Upload your file and select output format
4. Click Convert

<b>n8n Workflows for CAD:</b>
\u2022 n8n_1 (<code>run-cYpR0z9b</code>) \u2014 Primary converter
\u2022 n8n_2 (<code>run-DO7lywP4</code>) \u2014 Secondary + form

\u26A0\uFE0F CAD conversion requires RvtExporter.exe on a Windows machine with Revit installed.

\u{1F310} Open platform: http://localhost:5173/converter`)
})

// ─── /health ─────────────────────────────────────────────────────────────────

bot.onText(/\/health/, async (msg) => {
  const chatId = msg.chat.id
  bot.sendChatAction(chatId, 'typing')

  const checks = []

  // Backend
  const backendRes = await safeFetch(`${BACKEND_URL}/api/health`)
  let backendData = null
  if (backendRes?.ok) {
    try { backendData = await backendRes.json() } catch { /* */ }
  }
  checks.push({
    name: 'Express Backend',
    ok: backendRes?.ok || false,
    detail: backendData ? `Gemini: ${backendData.gemini ? 'ON' : 'OFF'}` : 'Unreachable',
  })

  // n8n
  const n8nRes = await safeFetch(`${N8N_URL}/healthz`)
  checks.push({
    name: 'n8n Engine',
    ok: n8nRes?.ok || false,
    detail: n8nRes?.ok ? 'Healthy' : 'Unreachable',
  })

  // Supabase
  const supabaseUrl = process.env.SUPABASE_URL
  if (supabaseUrl) {
    const sbRes = await safeFetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY || '' },
    })
    checks.push({
      name: 'Supabase DB',
      ok: sbRes?.ok || false,
      detail: sbRes?.ok ? 'Connected' : 'Unreachable',
    })
  }

  // Qdrant
  const qdrantRes = await safeFetch('http://localhost:6333/healthz')
  checks.push({
    name: 'Qdrant Vector DB',
    ok: qdrantRes?.ok || false,
    detail: qdrantRes?.ok ? 'Running' : 'Not running',
  })

  let text = `<b>System Health Check</b> \u{1F3E5}\n\n`
  for (const c of checks) {
    const icon = c.ok ? '\u2705' : '\u274C'
    text += `${icon} <b>${c.name}</b> \u2014 ${c.detail}\n`
  }

  const okCount = checks.filter(c => c.ok).length
  text += `\n${okCount === checks.length ? '\u2705' : '\u26A0\uFE0F'} <b>${okCount}/${checks.length}</b> services healthy`

  send(chatId, text)
})

// ─── /tovbin — AI search in chat history ─────────────────────────────────────

bot.onText(/\/tovbin(.*)/, async (msg, match) => {
  const chatId = msg.chat.id
  const rawQuestion = (match[1] || '').trim()

  if (!rawQuestion) {
    send(chatId, `<b>AI Chat Search</b> \u{1F50D}

Search through chat history using AI:

<code>/tovbin what did we discuss about concrete?</code>
<code>/tovbin who sent photos last week?</code>
<code>/tovbin find messages about budget</code>

In private chats you can search across all chats:
<code>/tovbin in Project Chat: deadline info</code>`)
    return
  }

  if (!supabase || !geminiModel) {
    send(chatId, '\u274C AI search is not configured (Supabase or Gemini missing).')
    return
  }

  bot.sendChatAction(chatId, 'typing')

  try {
    // Parse "in <chat_name>: <question>" for cross-chat search in private chats
    let searchChatId = chatId
    let question = rawQuestion
    const isPrivate = msg.chat.type === 'private'

    if (isPrivate) {
      const inMatch = rawQuestion.match(/^in\s+(.+?):\s*(.+)$/i)
      if (inMatch) {
        const chatName = inMatch[1].trim()
        question = inMatch[2].trim()
        // Find chat by title or username
        const { data: foundChats } = await supabase
          .from('telegram_chats')
          .select('id, title, username')
          .or(`title.ilike.%${chatName}%,username.ilike.%${chatName}%`)
          .limit(1)
        if (foundChats && foundChats.length > 0) {
          searchChatId = foundChats[0].id
        } else {
          send(chatId, `\u274C Chat "${escapeHtml(chatName)}" not found in history.`)
          return
        }
      }
    }

    // Extract keywords for search (words > 2 chars)
    const keywords = question
      .replace(/[^\w\u0400-\u04FF\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)

    // Keyword search
    let keywordMessages = []
    if (keywords.length > 0) {
      const orFilter = keywords.map(k => `text_content.ilike.%${k}%`).join(',')
      const { data } = await supabase
        .from('telegram_messages')
        .select('*')
        .eq('chat_id', searchChatId)
        .or(orFilter)
        .order('telegram_date', { ascending: false })
        .limit(100)
      keywordMessages = data || []
    }

    // Recent messages
    const { data: recentMessages } = await supabase
      .from('telegram_messages')
      .select('*')
      .eq('chat_id', searchChatId)
      .order('telegram_date', { ascending: false })
      .limit(200)

    // Deduplicate and sort by date
    const seen = new Set()
    const allMessages = []
    for (const m of [...keywordMessages, ...(recentMessages || [])]) {
      const key = `${m.chat_id}_${m.telegram_message_id}`
      if (!seen.has(key)) {
        seen.add(key)
        allMessages.push(m)
      }
    }
    allMessages.sort((a, b) => new Date(a.telegram_date) - new Date(b.telegram_date))

    if (allMessages.length === 0) {
      send(chatId, '\u{1F4ED} No messages found in this chat history yet.')
      return
    }

    // Build context (limit to 80000 chars)
    let context = ''
    for (const m of allMessages) {
      const date = new Date(m.telegram_date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
      const sender = m.from_first_name || m.from_username || 'Unknown'
      let line = `[${date}] ${sender}`
      if (m.message_type !== 'text') line += ` [${m.message_type}]`
      if (m.file_name) line += ` (${m.file_name})`
      if (m.text_content) line += `: ${m.text_content}`
      context += line + '\n'
      if (context.length > 80000) break
    }

    // Send to Gemini
    const prompt = `You are an assistant that answers questions based on Telegram chat history.
Here is the chat history (${allMessages.length} messages):

${context}

User's question: ${question}

Answer the question based ONLY on the chat history above. If the answer is not in the history, say so.
Answer in the same language as the question. Be concise and specific, referencing dates and senders when relevant.`

    const result = await geminiModel.generateContent(prompt)
    const answer = result.response.text()

    // Escape HTML in the answer
    const safeAnswer = escapeHtml(answer)

    send(chatId, `<b>AI Search Results</b> \u{1F50D}

<b>Q:</b> ${escapeHtml(question)}

${safeAnswer}

<i>\u{1F4CA} Analyzed ${allMessages.length} messages</i>`)
  } catch (err) {
    console.error('[TgBot] /tovbin error:', err.message)
    send(chatId, `\u274C Search error: ${escapeHtml(err.message)}`)
  }
})

// ─── Message handler — save ALL messages ─────────────────────────────────────

bot.on('message', async (msg) => {
  // Skip commands (handled by onText)
  if (msg.text && msg.text.startsWith('/')) return

  const chatId = msg.chat.id
  const isPrivate = msg.chat.type === 'private'

  try {
    // Determine message type and process accordingly
    if (msg.photo && msg.photo.length > 0) {
      const photo = msg.photo[msg.photo.length - 1] // largest size
      const filePath = await downloadAndSave(msg, photo.file_id, 'photos')
      await saveMessage(msg, 'photo', {
        text_content: msg.caption || null,
        telegram_file_id: photo.file_id,
        file_size: photo.file_size,
        file_path: filePath,
      })
      if (isPrivate) send(chatId, '\u{1F4F8} Photo saved.')

    } else if (msg.document) {
      const doc = msg.document
      const filePath = await downloadAndSave(msg, doc.file_id, 'documents')
      await saveMessage(msg, 'document', {
        text_content: msg.caption || null,
        telegram_file_id: doc.file_id,
        file_name: doc.file_name,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        file_path: filePath,
      })
      if (isPrivate) send(chatId, `\u{1F4C4} Document saved: ${escapeHtml(doc.file_name || 'file')}`)

    } else if (msg.voice) {
      const filePath = await downloadAndSave(msg, msg.voice.file_id, 'voice')
      await saveMessage(msg, 'voice', {
        telegram_file_id: msg.voice.file_id,
        file_size: msg.voice.file_size,
        mime_type: msg.voice.mime_type,
        file_path: filePath,
      })
      if (isPrivate) send(chatId, '\u{1F3A4} Voice message saved.')

    } else if (msg.video) {
      const filePath = await downloadAndSave(msg, msg.video.file_id, 'videos')
      await saveMessage(msg, 'video', {
        text_content: msg.caption || null,
        telegram_file_id: msg.video.file_id,
        file_size: msg.video.file_size,
        mime_type: msg.video.mime_type,
        file_path: filePath,
      })
      if (isPrivate) send(chatId, '\u{1F4F9} Video saved.')

    } else if (msg.video_note) {
      const filePath = await downloadAndSave(msg, msg.video_note.file_id, 'video_notes')
      await saveMessage(msg, 'video_note', {
        telegram_file_id: msg.video_note.file_id,
        file_size: msg.video_note.file_size,
        file_path: filePath,
      })
      if (isPrivate) send(chatId, '\u{1F4F9} Video note saved.')

    } else if (msg.audio) {
      const filePath = await downloadAndSave(msg, msg.audio.file_id, 'audio')
      await saveMessage(msg, 'audio', {
        text_content: msg.audio.title || msg.caption || null,
        telegram_file_id: msg.audio.file_id,
        file_name: msg.audio.file_name,
        file_size: msg.audio.file_size,
        mime_type: msg.audio.mime_type,
        file_path: filePath,
      })
      if (isPrivate) send(chatId, '\u{1F3B5} Audio saved.')

    } else if (msg.sticker) {
      await saveMessage(msg, 'sticker', {
        text_content: msg.sticker.emoji || null,
        telegram_file_id: msg.sticker.file_id,
      })

    } else if (msg.location) {
      await saveMessage(msg, 'location', {
        text_content: JSON.stringify({ lat: msg.location.latitude, lon: msg.location.longitude }),
      })
      if (isPrivate) send(chatId, '\u{1F4CD} Location saved.')

    } else if (msg.contact) {
      await saveMessage(msg, 'contact', {
        text_content: JSON.stringify({
          phone: msg.contact.phone_number,
          name: [msg.contact.first_name, msg.contact.last_name].filter(Boolean).join(' '),
        }),
      })
      if (isPrivate) send(chatId, '\u{1F4C7} Contact saved.')

    } else if (msg.text) {
      // Regular text message
      await saveMessage(msg, 'text')
      if (isPrivate) {
        send(chatId, '\u2705 Message saved. Use /tovbin to search chat history.')
      }
    }
  } catch (err) {
    console.error('[TgBot] message handler error:', err.message)
  }
})

// ─── Error handling ──────────────────────────────────────────────────────────

bot.on('polling_error', (err) => {
  if (err.code === 'ETELEGRAM' && err.message.includes('409')) {
    console.error('Another bot instance is running. Stop it first.')
    process.exit(1)
  }
  console.error('Polling error:', err.message)
})

process.on('SIGINT', () => {
  console.log('\nStopping bot...')
  bot.stopPolling()
  process.exit(0)
})

console.log('Bot is running. Send /start to @jenssssssssss_bot')
