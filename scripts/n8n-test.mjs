#!/usr/bin/env node
// ============================================================================
// n8n Workflow Test Script — Jens Platform
// ============================================================================
// Tests all n8n workflows via API: health, workflows, executions, webhooks
// Usage: node scripts/n8n-test.mjs
// ============================================================================

const N8N_BASE = process.env.N8N_URL || 'https://actor-won-translation-supervisor.trycloudflare.com'
const N8N_API = `${N8N_BASE}/api/v1`
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7579656533:AAHlGxCm2kRRtjauanKvxpEfNY9KV6LmCdo'

const WEBHOOK_ENDPOINTS = [
  { name: 'CWICR v10.9 #1 (Telegram Bot)', path: '/webhook/telegram-bot-5zNg8gkl', method: 'POST' },
  { name: 'Text Estimator v11 (Telegram Bot)', path: '/webhook/telegram-bot-ygHTL-eo', method: 'POST' },
  { name: 'n8n_1 Converter', path: '/webhook/run-cYpR0z9b', method: 'POST' },
  { name: 'n8n_2 Converter', path: '/webhook/run-DO7lywP4', method: 'POST' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const colors = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
  dim: (t) => `\x1b[2m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`,
}

const PASS = colors.green('PASS')
const FAIL = colors.red('FAIL')
const WARN = colors.yellow('WARN')
const SKIP = colors.dim('SKIP')

let passed = 0
let failed = 0
let warned = 0

function logResult(status, name, detail = '') {
  const icon = status === 'pass' ? PASS : status === 'fail' ? FAIL : status === 'warn' ? WARN : SKIP
  console.log(`  ${icon}  ${name}${detail ? colors.dim(` — ${detail}`) : ''}`)
  if (status === 'pass') passed++
  else if (status === 'fail') failed++
  else if (status === 'warn') warned++
}

async function safeFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, status: 0, statusText: err.message, _error: true, json: async () => ({}), text: async () => '' }
  }
}

// ─── Test Sections ───────────────────────────────────────────────────────────

async function testHealth() {
  console.log(colors.bold('\n1. Health Check'))
  console.log(colors.dim(`   ${N8N_BASE}/healthz`))

  const res = await safeFetch(`${N8N_BASE}/healthz`)
  if (res.ok) {
    logResult('pass', 'n8n instance is reachable', `HTTP ${res.status}`)
  } else if (res._error) {
    logResult('fail', 'n8n instance unreachable', res.statusText)
  } else {
    logResult('warn', 'n8n responded with non-200', `HTTP ${res.status}`)
  }
  return res.ok
}

async function testListWorkflows() {
  console.log(colors.bold('\n2. Workflows'))
  console.log(colors.dim(`   GET ${N8N_API}/workflows`))

  const res = await safeFetch(`${N8N_API}/workflows`)
  if (!res.ok) {
    logResult('fail', 'Cannot fetch workflows', res._error ? res.statusText : `HTTP ${res.status}`)
    return []
  }

  let data
  try {
    data = await res.json()
  } catch {
    logResult('fail', 'Invalid JSON response')
    return []
  }

  const workflows = data.data || data || []
  logResult('pass', `Found ${workflows.length} workflows`)

  for (const wf of workflows) {
    const active = wf.active ? colors.green('ACTIVE') : colors.red('INACTIVE')
    console.log(`         ${active}  ${colors.cyan(wf.name || wf.id)}  ${colors.dim(`id:${wf.id}`)}`)
  }

  return workflows
}

async function testExecutions() {
  console.log(colors.bold('\n3. Recent Executions'))
  console.log(colors.dim(`   GET ${N8N_API}/executions?limit=20`))

  const res = await safeFetch(`${N8N_API}/executions?limit=20`)
  if (!res.ok) {
    logResult('fail', 'Cannot fetch executions', res._error ? res.statusText : `HTTP ${res.status}`)
    return
  }

  let data
  try {
    data = await res.json()
  } catch {
    logResult('fail', 'Invalid JSON response')
    return
  }

  const execs = data.data || data || []
  logResult('pass', `Found ${execs.length} recent executions`)

  const statusCounts = {}
  for (const ex of execs) {
    const s = ex.status || ex.finished ? 'success' : 'unknown'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }

  for (const [status, count] of Object.entries(statusCounts)) {
    const color = status === 'success' ? colors.green : status === 'error' ? colors.red : colors.yellow
    console.log(`         ${color(status)}: ${count}`)
  }

  // Show last 5 with details
  const recent = execs.slice(0, 5)
  if (recent.length > 0) {
    console.log(colors.dim('         Last 5:'))
    for (const ex of recent) {
      const wfName = ex.workflowData?.name || ex.workflowId || '?'
      const status = ex.status || (ex.finished ? 'finished' : 'running')
      const started = ex.startedAt ? new Date(ex.startedAt).toLocaleString() : '?'
      const statusColor = status === 'success' ? colors.green : status === 'error' ? colors.red : colors.yellow
      console.log(`         ${statusColor(status.padEnd(8))} ${wfName}  ${colors.dim(started)}`)
    }
  }
}

async function testWebhooks() {
  console.log(colors.bold('\n4. Webhook Endpoints'))

  for (const ep of WEBHOOK_ENDPOINTS) {
    const url = `${N8N_BASE}${ep.path}`
    console.log(colors.dim(`   ${ep.method} ${url}`))

    const testPayload = {
      test: true,
      source: 'n8n-test.mjs',
      timestamp: new Date().toISOString(),
      message: 'Test webhook from Jens Platform',
    }

    const res = await safeFetch(url, {
      method: ep.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    })

    if (res._error) {
      logResult('fail', ep.name, `Unreachable: ${res.statusText}`)
    } else if (res.status === 404) {
      logResult('warn', ep.name, 'Webhook not found (404) — workflow may be inactive')
    } else if (res.status === 200 || res.status === 201) {
      let body = ''
      try { body = await res.text() } catch { /* */ }
      logResult('pass', ep.name, `HTTP ${res.status}${body ? ` — ${body.slice(0, 80)}` : ''}`)
    } else {
      logResult('warn', ep.name, `HTTP ${res.status} ${res.statusText}`)
    }
  }
}

async function testTelegramWebhookInfo() {
  console.log(colors.bold('\n5. Telegram Webhook Info'))
  console.log(colors.dim(`   Checking bot webhook configuration...`))

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`
  const res = await safeFetch(url)

  if (res._error) {
    logResult('fail', 'Cannot reach Telegram API', res.statusText)
    return
  }

  let data
  try {
    data = await res.json()
  } catch {
    logResult('fail', 'Invalid response from Telegram')
    return
  }

  if (!data.ok) {
    logResult('fail', 'Telegram API error', data.description || 'Unknown')
    return
  }

  const info = data.result
  if (info.url) {
    logResult('pass', 'Webhook is set', info.url)
    if (info.last_error_date) {
      const errorAge = Math.round((Date.now() / 1000 - info.last_error_date) / 60)
      logResult('warn', 'Last webhook error', `${info.last_error_message} (${errorAge} min ago)`)
    }
    console.log(`         Pending updates: ${info.pending_update_count || 0}`)
    if (info.ip_address) console.log(`         IP: ${info.ip_address}`)
  } else {
    logResult('warn', 'No webhook URL set', 'Bot is not configured for webhooks')
  }
}

async function testFormTrigger() {
  console.log(colors.bold('\n6. Form Trigger (n8n_2)'))

  // Form triggers respond to GET with the form HTML
  const formUrl = `${N8N_BASE}/form/run-DO7lywP4`
  console.log(colors.dim(`   GET ${formUrl}`))

  const res = await safeFetch(formUrl)
  if (res._error) {
    logResult('fail', 'Form trigger unreachable', res.statusText)
  } else if (res.ok) {
    const body = await res.text().catch(() => '')
    const hasForm = body.includes('form') || body.includes('input') || body.includes('html')
    if (hasForm) {
      logResult('pass', 'Form trigger responds with form HTML')
    } else {
      logResult('warn', 'Form trigger responded but content unclear', `${body.length} bytes`)
    }
  } else {
    logResult('warn', 'Form trigger returned', `HTTP ${res.status}`)
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

function printReport() {
  console.log('\n' + '='.repeat(60))
  console.log(colors.bold('  n8n Test Report'))
  console.log('='.repeat(60))
  console.log(`  ${colors.green(`Passed: ${passed}`)}`)
  console.log(`  ${colors.red(`Failed: ${failed}`)}`)
  console.log(`  ${colors.yellow(`Warnings: ${warned}`)}`)
  console.log('='.repeat(60))

  console.log(colors.bold('\n  Known Issues & Recommendations:'))
  console.log(colors.dim('  ──────────────────────────────────'))
  console.log(`  ${colors.red('!')} Qdrant not deployed — CWICR semantic search disabled`)
  console.log(`  ${colors.red('!')} OpenAI API missing — replace with Gemini for embeddings`)
  console.log(`  ${colors.yellow('~')} Cloudflare tunnel URL is temporary — webhook URLs will break`)
  console.log(`  ${colors.yellow('~')} Hardcoded paths (C:\\Users\\Artem Boiko\\...) in CAD workflows`)
  console.log(`  ${colors.yellow('~')} CAD workflows (n8n_1-9) require local RvtExporter.exe`)
  console.log(`  ${colors.green('+')} Photo Cost Estimate Pro v2.0 — should work (form trigger)`)
  console.log(`  ${colors.green('+')} CWICR Telegram bots — will work after Qdrant + embeddings`)
  console.log('')
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60))
  console.log(colors.bold('  n8n Workflow Test Suite — Jens Platform'))
  console.log(colors.dim(`  Target: ${N8N_BASE}`))
  console.log(colors.dim(`  Time:   ${new Date().toLocaleString()}`))
  console.log('='.repeat(60))

  const healthy = await testHealth()

  if (healthy) {
    await testListWorkflows()
    await testExecutions()
    await testWebhooks()
  } else {
    console.log(colors.red('\n  n8n is unreachable — skipping API tests'))
    console.log(colors.dim('  Make sure n8n is running and the URL is correct'))
    console.log(colors.dim(`  Current URL: ${N8N_BASE}`))
  }

  await testTelegramWebhookInfo()
  await testFormTrigger()

  printReport()
}

main().catch((err) => {
  console.error(colors.red('Fatal error:'), err.message)
  process.exit(1)
})
