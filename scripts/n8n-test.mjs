#!/usr/bin/env node
// ============================================================================
// n8n Workflow Test Suite — Jens Platform
// ============================================================================
// Remote-first full integration checks using env-only config.
// Required env:
//   N8N_URL
// Optional env:
//   N8N_WEBHOOK_BASE_URL
//   N8N_API_KEY
//   TELEGRAM_BOT_TOKEN
// ============================================================================

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const N8N_BASE = (process.env.N8N_URL || '').replace(/\/+$/, '')
const N8N_WEBHOOK_BASE = (process.env.N8N_WEBHOOK_BASE_URL || N8N_BASE || '').replace(/\/+$/, '')
const N8N_API_KEY = process.env.N8N_API_KEY || ''
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

if (!N8N_BASE) {
  console.error('ERROR: N8N_URL is required. Example: N8N_URL=https://your-n8n-url node scripts/n8n-test.mjs')
  process.exit(1)
}

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
const records = []

function logResult(status, name, detail = '', meta = {}) {
  const icon = status === 'pass' ? PASS : status === 'fail' ? FAIL : status === 'warn' ? WARN : SKIP
  console.log(`  ${icon}  ${name}${detail ? colors.dim(` — ${detail}`) : ''}`)
  records.push({
    status,
    name,
    detail,
    ...meta,
  })

  if (status === 'pass') passed++
  else if (status === 'fail') failed++
  else if (status === 'warn') warned++
}

function normalizeExecutionStatus(execution) {
  if (execution?.status) return String(execution.status)
  if (execution?.finished === true) return 'success'
  if (execution?.finished === false) return 'error'
  if (execution?.stoppedAt) return 'success'
  return 'running'
}

async function safeFetch(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const startedAt = Date.now()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const durationMs = Date.now() - startedAt
    return { ok: true, res, durationMs }
  } catch (err) {
    const durationMs = Date.now() - startedAt
    return { ok: false, err, durationMs }
  } finally {
    clearTimeout(timer)
  }
}

async function readJsonResponse(res) {
  const text = await res.text().catch(() => '')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

function apiHeaders(extra = {}) {
  const headers = { Accept: 'application/json', ...extra }
  if (N8N_API_KEY) headers['X-N8N-API-KEY'] = N8N_API_KEY
  return headers
}

async function n8nApiGet(path) {
  const url = `${N8N_BASE}/api/v1/${String(path).replace(/^\/+/, '')}`
  const result = await safeFetch(url, { headers: apiHeaders() }, 20000)
  if (!result.ok) {
    return { ok: false, status: 0, data: null, error: result.err.message, durationMs: result.durationMs, url }
  }
  const data = await readJsonResponse(result.res)
  return {
    ok: result.res.ok,
    status: result.res.status,
    data,
    error: result.res.ok ? '' : JSON.stringify(data).slice(0, 200),
    durationMs: result.durationMs,
    url,
  }
}

function detectTriggerType(nodeType = '') {
  const type = String(nodeType || '')
  if (type === 'n8n-nodes-base.webhook') return 'webhook'
  if (type === 'n8n-nodes-base.formTrigger') return 'form'
  if (type === 'n8n-nodes-base.telegramTrigger') return 'telegram'
  if (type === 'n8n-nodes-base.scheduleTrigger') return 'schedule'
  if (type === 'n8n-nodes-base.manualTrigger') return 'manual'
  if (type === 'n8n-nodes-base.chatTrigger') return 'chat'
  return null
}

function buildEndpointPath(workflowId, triggerType, path, webhookId) {
  const cleanPath = (path || '').toString().trim().replace(/^\/+/, '')
  if (triggerType === 'webhook') return cleanPath ? `/webhook/${cleanPath}` : null
  if (triggerType === 'form') {
    if (cleanPath) return `/form/${cleanPath}`
    if (webhookId) return `/form/${webhookId}`
    return `/form/run-${String(workflowId).slice(0, 8)}`
  }
  return null
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testHealth() {
  console.log(colors.bold('\n1. Health Check'))
  const url = `${N8N_BASE}/healthz`
  console.log(colors.dim(`   GET ${url}`))

  const result = await safeFetch(url, { headers: apiHeaders() }, 8000)
  if (!result.ok) {
    logResult('fail', 'n8n unreachable', result.err.message, { url, latencyMs: result.durationMs })
    return false
  }
  if (!result.res.ok) {
    logResult('warn', 'n8n non-200 health response', `HTTP ${result.res.status}`, { url, latencyMs: result.durationMs })
    return false
  }
  logResult('pass', 'n8n instance reachable', `HTTP ${result.res.status}`, { url, latencyMs: result.durationMs })
  return true
}

async function testApiAuth() {
  console.log(colors.bold('\n2. API Auth & Workflow List'))
  console.log(colors.dim(`   GET ${N8N_BASE}/api/v1/workflows`))

  const response = await n8nApiGet('/workflows')
  if (!response.ok) {
    const level = response.status === 401 || response.status === 403 ? 'fail' : 'warn'
    logResult(level, 'Cannot access n8n API workflows', response.error || `HTTP ${response.status}`, {
      url: response.url,
      httpStatus: response.status,
      latencyMs: response.durationMs,
    })
    return []
  }

  const workflows = response.data?.data || response.data || []
  logResult('pass', `Loaded workflows: ${workflows.length}`, `HTTP ${response.status}`, {
    url: response.url,
    httpStatus: response.status,
    latencyMs: response.durationMs,
  })

  for (const wf of workflows) {
    const active = wf.active ? colors.green('ACTIVE') : colors.red('INACTIVE')
    console.log(`         ${active} ${colors.cyan(wf.name || wf.id)} ${colors.dim(`id:${wf.id}`)}`)
  }
  return workflows
}

async function discoverTriggers(workflows) {
  console.log(colors.bold('\n3. Trigger Discovery'))
  const triggerMap = []
  let failures = 0

  for (const workflow of workflows) {
    const details = await n8nApiGet(`/workflows/${encodeURIComponent(workflow.id)}`)
    if (!details.ok) {
      failures++
      logResult('warn', `Cannot inspect workflow ${workflow.id}`, details.error || `HTTP ${details.status}`, {
        workflowId: workflow.id,
        workflowName: workflow.name,
      })
      continue
    }

    const nodes = Array.isArray(details.data?.nodes) ? details.data.nodes : []
    const triggers = []

    for (const node of nodes) {
      const triggerType = detectTriggerType(node.type)
      if (!triggerType) continue
      const method = node?.parameters?.httpMethod ? String(node.parameters.httpMethod).toUpperCase() : (triggerType === 'webhook' ? 'POST' : triggerType === 'form' ? 'GET' : null)
      const endpointPath = buildEndpointPath(workflow.id, triggerType, node?.parameters?.path, node?.webhookId)
      triggers.push({
        workflowId: workflow.id,
        workflowName: workflow.name,
        workflowActive: !!workflow.active,
        nodeName: node.name || '',
        nodeType: node.type || '',
        triggerType,
        method,
        endpointPath,
        disabled: !!node.disabled,
      })
    }

    triggerMap.push(...triggers)
  }

  const activeTriggerCount = triggerMap.filter((t) => !t.disabled).length
  const webhookCount = triggerMap.filter((t) => t.triggerType === 'webhook' && !t.disabled).length
  const formCount = triggerMap.filter((t) => t.triggerType === 'form' && !t.disabled).length

  if (failures > 0) {
    logResult('warn', 'Trigger discovery completed with partial failures', `${failures} workflows not inspectable`)
  }
  logResult('pass', `Discovered active triggers: ${activeTriggerCount}`, `webhooks=${webhookCount}, forms=${formCount}`)

  return triggerMap
}

async function testExecutions() {
  console.log(colors.bold('\n4. Executions'))
  const response = await n8nApiGet('/executions?limit=20')
  if (!response.ok) {
    logResult('fail', 'Cannot fetch executions', response.error || `HTTP ${response.status}`, {
      url: response.url,
      httpStatus: response.status,
      latencyMs: response.durationMs,
    })
    return []
  }

  const executions = response.data?.data || response.data || []
  logResult('pass', `Loaded executions: ${executions.length}`, `HTTP ${response.status}`, {
    url: response.url,
    latencyMs: response.durationMs,
  })

  const statusCounts = {}
  for (const ex of executions) {
    const s = normalizeExecutionStatus(ex)
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }
  for (const [status, count] of Object.entries(statusCounts)) {
    const color = status === 'success' ? colors.green : status === 'error' ? colors.red : colors.yellow
    console.log(`         ${color(status)}: ${count}`)
  }

  return executions
}

async function testExecutionStatus(executions) {
  console.log(colors.bold('\n5. Single Execution Status'))
  const sample = executions[0]
  if (!sample?.id) {
    logResult('skip', 'No execution available for /status check')
    return
  }
  const response = await n8nApiGet(`/executions/${encodeURIComponent(sample.id)}`)
  if (!response.ok) {
    logResult('fail', `Cannot fetch execution ${sample.id}`, response.error || `HTTP ${response.status}`)
    return
  }
  const status = normalizeExecutionStatus(response.data)
  logResult('pass', `Execution ${sample.id} status fetched`, status, {
    executionId: sample.id,
    latencyMs: response.durationMs,
  })
}

async function testWebhookTriggers(triggerMap) {
  console.log(colors.bold('\n6. Webhook Real-Run'))
  const webhookTriggers = triggerMap
    .filter((t) => t.triggerType === 'webhook' && !t.disabled && t.endpointPath && (t.method || 'POST') === 'POST')

  if (webhookTriggers.length === 0) {
    logResult('skip', 'No active webhook POST triggers found')
    return []
  }

  const results = []
  for (const trigger of webhookTriggers) {
    const url = `${N8N_WEBHOOK_BASE}${trigger.endpointPath}`
    console.log(colors.dim(`   POST ${url}`))

    const payload = {
      source: 'scripts/n8n-test.mjs',
      workflowId: trigger.workflowId,
      workflowName: trigger.workflowName,
      timestamp: new Date().toISOString(),
      test: true,
      message: 'Automated webhook integration test',
    }

    const result = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, 25000)

    if (!result.ok) {
      logResult('fail', `${trigger.workflowName} :: ${trigger.nodeName}`, result.err.message, {
        endpoint: trigger.endpointPath,
      })
      results.push({ trigger, ok: false, error: result.err.message })
      continue
    }

    const body = await readJsonResponse(result.res)
    if (result.res.status === 404) {
      logResult('warn', `${trigger.workflowName} :: ${trigger.nodeName}`, 'Webhook returned 404', {
        endpoint: trigger.endpointPath,
        httpStatus: result.res.status,
      })
    } else if (result.res.ok) {
      logResult('pass', `${trigger.workflowName} :: ${trigger.nodeName}`, `HTTP ${result.res.status}`, {
        endpoint: trigger.endpointPath,
        httpStatus: result.res.status,
        latencyMs: result.durationMs,
      })
    } else {
      logResult('warn', `${trigger.workflowName} :: ${trigger.nodeName}`, `HTTP ${result.res.status}`, {
        endpoint: trigger.endpointPath,
        httpStatus: result.res.status,
      })
    }
    results.push({ trigger, ok: result.res.ok, status: result.res.status, body })
  }
  return results
}

async function testFormTriggers(triggerMap) {
  console.log(colors.bold('\n7. Form Trigger Check'))
  const formTriggers = triggerMap.filter((t) => t.triggerType === 'form' && !t.disabled && t.endpointPath)

  if (formTriggers.length === 0) {
    logResult('skip', 'No active form triggers found')
    return
  }

  for (const trigger of formTriggers) {
    const url = `${N8N_WEBHOOK_BASE}${trigger.endpointPath}`
    console.log(colors.dim(`   GET ${url}`))
    const result = await safeFetch(url, {}, 15000)
    if (!result.ok) {
      logResult('warn', `${trigger.workflowName} :: form`, result.err.message, { endpoint: trigger.endpointPath })
      continue
    }
    const html = await result.res.text().catch(() => '')
    const hasForm = /<form|<input|<html/i.test(html)
    if (result.res.ok && hasForm) {
      logResult('pass', `${trigger.workflowName} :: form reachable`, `HTTP ${result.res.status}`, {
        endpoint: trigger.endpointPath,
        httpStatus: result.res.status,
      })
    } else if (result.res.ok) {
      logResult('warn', `${trigger.workflowName} :: form response unclear`, `${html.length} bytes`, {
        endpoint: trigger.endpointPath,
      })
    } else {
      logResult('warn', `${trigger.workflowName} :: form non-200`, `HTTP ${result.res.status}`, {
        endpoint: trigger.endpointPath,
      })
    }
  }
}

async function testTelegramWebhookInfo() {
  console.log(colors.bold('\n8. Telegram Webhook Info'))
  if (!TELEGRAM_TOKEN) {
    logResult('skip', 'TELEGRAM_BOT_TOKEN not set, skipping Telegram API check')
    return
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`
  const result = await safeFetch(url, {}, 10000)
  if (!result.ok) {
    logResult('fail', 'Cannot reach Telegram API', result.err.message)
    return
  }
  const data = await readJsonResponse(result.res)
  if (!data.ok) {
    logResult('fail', 'Telegram API returned error', data.description || `HTTP ${result.res.status}`)
    return
  }
  const info = data.result || {}
  if (info.url) {
    logResult('pass', 'Telegram webhook configured', info.url, { pendingUpdates: info.pending_update_count || 0 })
  } else {
    logResult('warn', 'Telegram webhook URL is empty')
  }
}

async function testNegativeCases() {
  console.log(colors.bold('\n9. Negative Cases'))
  const invalidWebhook = `${N8N_WEBHOOK_BASE}/webhook/__non_existing_trigger_for_test__`
  const res = await safeFetch(invalidWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: true }),
  }, 10000)

  if (!res.ok) {
    logResult('warn', 'Invalid webhook path network error', res.err.message)
    return
  }
  if (res.res.status === 404 || res.res.status === 400) {
    logResult('pass', 'Invalid webhook path handled correctly', `HTTP ${res.res.status}`)
  } else {
    logResult('warn', 'Invalid webhook path unexpected status', `HTTP ${res.res.status}`)
  }

  if (!N8N_API_KEY) {
    logResult('skip', 'N8N_API_KEY not set, skipping invalid-key API case')
    return
  }

  const wrongKeyResult = await safeFetch(`${N8N_BASE}/api/v1/workflows`, {
    headers: { 'X-N8N-API-KEY': 'invalid-key-for-test', Accept: 'application/json' },
  }, 10000)

  if (!wrongKeyResult.ok) {
    logResult('warn', 'Invalid API key test failed by network error', wrongKeyResult.err.message)
    return
  }

  if (wrongKeyResult.res.status === 401 || wrongKeyResult.res.status === 403) {
    logResult('pass', 'Invalid API key correctly rejected', `HTTP ${wrongKeyResult.res.status}`)
  } else {
    logResult('warn', 'Invalid API key unexpected response', `HTTP ${wrongKeyResult.res.status}`)
  }
}

function printReport() {
  console.log('\n' + '='.repeat(72))
  console.log(colors.bold('  n8n Integration Test Report'))
  console.log('='.repeat(72))
  console.log(`  ${colors.green(`Passed: ${passed}`)}`)
  console.log(`  ${colors.red(`Failed: ${failed}`)}`)
  console.log(`  ${colors.yellow(`Warnings: ${warned}`)}`)
  console.log('='.repeat(72))

  const fails = records.filter((r) => r.status === 'fail')
  const warns = records.filter((r) => r.status === 'warn')

  if (fails.length > 0) {
    console.log(colors.bold('\n  Failed cases:'))
    for (const f of fails) {
      console.log(`  - ${f.name}: ${f.detail || 'No details'}`)
    }
  }
  if (warns.length > 0) {
    console.log(colors.bold('\n  Warnings:'))
    for (const w of warns) {
      console.log(`  - ${w.name}: ${w.detail || 'No details'}`)
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(72))
  console.log(colors.bold('  n8n Workflow Test Suite — Jens Platform'))
  console.log(colors.dim(`  N8N_URL:            ${N8N_BASE}`))
  console.log(colors.dim(`  N8N_WEBHOOK_BASE:   ${N8N_WEBHOOK_BASE || '(not set)'}`))
  console.log(colors.dim(`  N8N_API_KEY:        ${N8N_API_KEY ? `set (len=${N8N_API_KEY.length})` : 'not set'}`))
  console.log(colors.dim(`  TELEGRAM_BOT_TOKEN: ${TELEGRAM_TOKEN ? 'set' : 'not set'}`))
  console.log(colors.dim(`  Time:               ${new Date().toLocaleString()}`))
  console.log('='.repeat(72))

  const healthy = await testHealth()
  if (!healthy) {
    printReport()
    process.exit(failed > 0 ? 1 : 0)
  }

  const workflows = await testApiAuth()
  const triggerMap = workflows.length > 0 ? await discoverTriggers(workflows) : []
  const executions = await testExecutions()
  await testExecutionStatus(executions)
  await testWebhookTriggers(triggerMap)
  await testFormTriggers(triggerMap)
  await testTelegramWebhookInfo()
  await testNegativeCases()

  printReport()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(colors.red(`Fatal error: ${err.message}`))
  process.exit(1)
})
