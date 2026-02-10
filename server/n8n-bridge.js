// ============================================================================
// n8n Bridge — Jens Platform Integration Module
// ============================================================================
// Provides functions to interact with n8n workflows from Express backend.
// Supports both local n8n (localhost:5678) and remote (Cloudflare tunnel).
// ============================================================================

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const N8N_URL = process.env.N8N_URL || 'http://localhost:5678'
const N8N_API_KEY = process.env.N8N_API_KEY || ''
const N8N_WEBHOOK_BASE_URL = process.env.N8N_WEBHOOK_BASE_URL || N8N_URL

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIGGER_NODE_TYPES = {
  webhook: ['n8n-nodes-base.webhook'],
  form: ['n8n-nodes-base.formTrigger'],
  telegram: ['n8n-nodes-base.telegramTrigger'],
  schedule: ['n8n-nodes-base.scheduleTrigger'],
  manual: ['n8n-nodes-base.manualTrigger'],
  chat: ['n8n-nodes-base.chatTrigger'],
}

export class N8nBridgeError extends Error {
  constructor(message, { status = 502, code = 'N8N_ERROR', url, details } = {}) {
    super(message)
    this.name = 'N8nBridgeError'
    this.status = status
    this.code = code
    this.url = url
    this.details = details
  }
}

function apiHeaders(overrides = {}) {
  const headers = {
    Accept: 'application/json',
    ...overrides,
  }
  if (N8N_API_KEY) {
    headers['X-N8N-API-KEY'] = N8N_API_KEY
  }
  return headers
}

function bodyPreview(body) {
  if (body == null) return ''
  if (typeof body === 'string') return body.slice(0, 240)
  try {
    return JSON.stringify(body).slice(0, 240)
  } catch {
    return ''
  }
}

async function parseResponseBody(res) {
  const raw = await res.text().catch(() => '')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

async function safeFetch(url, options = {}, timeoutMs = 30000, operation = 'n8n request') {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new N8nBridgeError(`${operation} timed out after ${timeoutMs}ms`, {
        status: 504,
        code: 'N8N_TIMEOUT',
        url,
      })
    }
    throw new N8nBridgeError(`${operation} failed: ${err.message}`, {
      status: 502,
      code: 'N8N_UNREACHABLE',
      url,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function safeJson(url, options = {}, timeoutMs = 30000, operation = 'n8n request') {
  const res = await safeFetch(url, options, timeoutMs, operation)
  const body = await parseResponseBody(res)

  if (!res.ok) {
    const preview = bodyPreview(body)
    throw new N8nBridgeError(
      `${operation} failed: HTTP ${res.status}${preview ? ` — ${preview}` : ''}`,
      {
        status: res.status,
        code: 'N8N_HTTP_ERROR',
        url,
        details: body,
      },
    )
  }

  return body || {}
}

function normalizeExecutionStatus(execution) {
  if (execution?.status) return String(execution.status)
  if (execution?.stoppedAt && execution?.finished !== false) return 'success'
  if (execution?.finished === true) return 'success'
  if (execution?.finished === false) return 'error'
  return 'running'
}

function normalizeWebhookPath(webhookPath) {
  if (typeof webhookPath !== 'string' || !webhookPath.trim()) {
    throw new N8nBridgeError('webhookPath must be a non-empty string', {
      status: 400,
      code: 'INVALID_WEBHOOK_PATH',
    })
  }

  const raw = webhookPath.trim()
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const parsed = new URL(raw)
      return parsed.pathname || '/'
    } catch {
      throw new N8nBridgeError('webhookPath URL is invalid', {
        status: 400,
        code: 'INVALID_WEBHOOK_PATH',
      })
    }
  }

  if (
    raw.startsWith('/webhook/') ||
    raw.startsWith('/webhook-test/') ||
    raw.startsWith('/form/')
  ) {
    return raw
  }

  if (
    raw.startsWith('webhook/') ||
    raw.startsWith('webhook-test/') ||
    raw.startsWith('form/')
  ) {
    return `/${raw}`
  }

  if (raw.startsWith('/')) {
    return raw
  }

  return `/webhook/${raw}`
}

function detectTriggerType(nodeType = '') {
  const type = String(nodeType || '')
  for (const [triggerType, allowedTypes] of Object.entries(TRIGGER_NODE_TYPES)) {
    if (allowedTypes.includes(type)) return triggerType
  }
  return null
}

function normalizeMethod(triggerType, rawMethod) {
  if (rawMethod) return String(rawMethod).toUpperCase()
  if (triggerType === 'webhook') return 'POST'
  if (triggerType === 'form') return 'GET'
  return null
}

function normalizeEndpointPath(triggerType, path) {
  if (!path) return null
  const cleanPath = String(path).trim().replace(/^\/+/, '')
  if (!cleanPath) return null

  if (triggerType === 'webhook') {
    return cleanPath.startsWith('webhook/') ? `/${cleanPath}` : `/webhook/${cleanPath}`
  }

  if (triggerType === 'form') {
    return cleanPath.startsWith('form/') ? `/${cleanPath}` : `/form/${cleanPath}`
  }

  return null
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Trigger an n8n workflow via webhook.
 * @param {string} webhookPath — e.g. '/webhook/run-cYpR0z9b' or 'run-cYpR0z9b'
 * @param {object} data — payload to POST
 * @returns {Promise<{status: number, data: any}>}
 */
export async function triggerWorkflow(webhookPath, data = {}) {
  const fullPath = normalizeWebhookPath(webhookPath)
  const url = `${N8N_WEBHOOK_BASE_URL}${fullPath}`

  console.log(`[n8n-bridge] Triggering webhook: ${url}`)

  const res = await safeFetch(url, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  }, 30000, 'Trigger workflow')
  const body = await parseResponseBody(res)

  return { status: res.status, data: body }
}

/**
 * Get execution status by ID.
 * @param {string} executionId
 * @returns {Promise<object>}
 */
export async function getWorkflowStatus(executionId) {
  if (!executionId) {
    throw new N8nBridgeError('executionId is required', { status: 400, code: 'INVALID_EXECUTION_ID' })
  }
  const url = `${N8N_URL}/api/v1/executions/${executionId}`
  return safeJson(url, { headers: apiHeaders() }, 30000, `Get execution ${executionId}`)
}

/**
 * List all workflows.
 * @returns {Promise<Array<{id: string, name: string, active: boolean, createdAt: string, updatedAt: string}>>}
 */
export async function listWorkflows() {
  const url = `${N8N_URL}/api/v1/workflows`
  const json = await safeJson(url, { headers: apiHeaders() }, 30000, 'List workflows')
  return (json.data || json || []).map((wf) => ({
    id: wf.id,
    name: wf.name,
    active: wf.active,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
    tags: wf.tags || [],
  }))
}

/**
 * Get recent executions, optionally filtered by workflow ID.
 * @param {string} [workflowId] — filter by workflow
 * @param {number} [limit=20] — max results
 * @returns {Promise<Array>}
 */
export async function getExecutions(workflowId, limit = 20) {
  let url = `${N8N_URL}/api/v1/executions?limit=${Number(limit) > 0 ? Number(limit) : 20}`
  if (workflowId) {
    url += `&workflowId=${encodeURIComponent(workflowId)}`
  }

  const json = await safeJson(url, { headers: apiHeaders() }, 30000, 'List executions')
  return (json.data || json || []).map((ex) => ({
    id: ex.id,
    workflowId: ex.workflowId,
    workflowName: ex.workflowData?.name || null,
    status: normalizeExecutionStatus(ex),
    startedAt: ex.startedAt,
    stoppedAt: ex.stoppedAt,
    mode: ex.mode,
  }))
}

/**
 * Check if n8n is reachable.
 * @returns {Promise<{online: boolean, url: string}>}
 */
export async function checkHealth() {
  try {
    const res = await safeFetch(`${N8N_URL}/healthz`, { headers: apiHeaders() }, 5000, 'Health check')
    return { online: res.ok, url: N8N_URL }
  } catch (err) {
    return {
      online: false,
      url: N8N_URL,
      error: err?.message || 'Unknown n8n health error',
      code: err?.code || 'N8N_HEALTH_ERROR',
    }
  }
}

/**
 * List workflow triggers to map UI actions to real n8n trigger nodes.
 * @returns {Promise<Array<{workflowId: string, workflowName: string, active: boolean, triggers: Array}>>}
 */
export async function listWorkflowTriggers() {
  const workflows = await listWorkflows()

  const triggerMaps = await Promise.all(workflows.map(async (wf) => {
    const workflowDetail = await safeJson(
      `${N8N_URL}/api/v1/workflows/${encodeURIComponent(wf.id)}`,
      { headers: apiHeaders() },
      30000,
      `Get workflow ${wf.id}`,
    )

    const nodes = Array.isArray(workflowDetail.nodes) ? workflowDetail.nodes : []
    const triggers = nodes
      .map((node) => {
        const triggerType = detectTriggerType(node.type)
        if (!triggerType) return null

        const rawPath = node?.parameters?.path || null
        const method = normalizeMethod(triggerType, node?.parameters?.httpMethod)
        const endpointPath =
          normalizeEndpointPath(triggerType, rawPath)
          || (triggerType === 'form' && node.webhookId ? `/form/${node.webhookId}` : null)

        return {
          nodeId: node.id || null,
          nodeName: node.name || null,
          nodeType: node.type || null,
          triggerType,
          method,
          path: rawPath,
          endpointPath,
          webhookId: node.webhookId || null,
          disabled: !!node.disabled,
        }
      })
      .filter(Boolean)

    return {
      workflowId: wf.id,
      workflowName: wf.name,
      active: !!wf.active,
      updatedAt: wf.updatedAt,
      triggers,
    }
  }))

  return triggerMaps
}

// ─── Workflow → Module Mapping ───────────────────────────────────────────────

export const WORKFLOW_MODULES = {
  converter: [
    { webhook: '/webhook/run-cYpR0z9b', name: 'n8n_1 Converter' },
    { webhook: '/webhook/run-DO7lywP4', name: 'n8n_2 Converter' },
  ],
  costEstimate: [
    { webhook: '/webhook/telegram-bot-5zNg8gkl', name: 'CWICR v10.9' },
  ],
  projectMgmt: [],
  validation: [],
  qto: [],
}

export default {
  triggerWorkflow,
  getWorkflowStatus,
  listWorkflows,
  listWorkflowTriggers,
  getExecutions,
  checkHealth,
  N8nBridgeError,
  WORKFLOW_MODULES,
}
