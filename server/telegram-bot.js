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

<b>Examples:</b>
\u2022 <code>/estimate reinforced concrete foundation</code>
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

// ─── Free text (no command) ──────────────────────────────────────────────────

bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) return
  const chatId = msg.chat.id

  if (msg.text) {
    const short = msg.text.length > 30 ? msg.text.slice(0, 30) + '...' : msg.text
    send(chatId, `I received your message. Here's what I can help with:

\u{1F4B0} Cost estimate: <code>/estimate ${short}</code>
\u{1F4CA} Platform status: /status
\u{1F4CB} Tasks: /tasks
\u{1F4D6} All commands: /help`)
  }

  if (msg.document) {
    const fileName = msg.document.file_name || 'file'
    const ext = fileName.split('.').pop().toLowerCase()
    const cadExts = ['rvt', 'ifc', 'dwg', 'dgn', 'dxf']

    if (cadExts.includes(ext)) {
      send(chatId, `\u{1F4C2} <b>CAD file detected:</b> <code>${fileName}</code>

File conversion through Telegram is coming soon!
For now, use the web interface:

\u{1F310} http://localhost:5173/converter

Upload your .${ext} file there for conversion.`)
    }
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
