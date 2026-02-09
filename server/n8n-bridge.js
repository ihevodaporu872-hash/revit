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

function apiHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (N8N_API_KEY) {
    headers['X-N8N-API-KEY'] = N8N_API_KEY
  }
  return headers
}

async function safeFetch(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw new Error(`n8n unreachable: ${err.message}`)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Trigger an n8n workflow via webhook.
 * @param {string} webhookPath — e.g. '/webhook/run-cYpR0z9b' or 'run-cYpR0z9b'
 * @param {object} data — payload to POST
 * @returns {Promise<{status: number, data: any}>}
 */
export async function triggerWorkflow(webhookPath, data = {}) {
  const fullPath = webhookPath.startsWith('/') ? webhookPath : `/webhook/${webhookPath}`
  const url = `${N8N_WEBHOOK_BASE_URL}${fullPath}`

  console.log(`[n8n-bridge] Triggering webhook: ${url}`)

  const res = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  let body
  try {
    body = await res.json()
  } catch {
    body = await res.text().catch(() => null)
  }

  return { status: res.status, data: body }
}

/**
 * Get execution status by ID.
 * @param {string} executionId
 * @returns {Promise<object>}
 */
export async function getWorkflowStatus(executionId) {
  const url = `${N8N_URL}/api/v1/executions/${executionId}`
  const res = await safeFetch(url, { headers: apiHeaders() })

  if (!res.ok) {
    throw new Error(`Failed to get execution ${executionId}: HTTP ${res.status}`)
  }

  return res.json()
}

/**
 * List all workflows.
 * @returns {Promise<Array<{id: string, name: string, active: boolean, createdAt: string, updatedAt: string}>>}
 */
export async function listWorkflows() {
  const url = `${N8N_URL}/api/v1/workflows`
  const res = await safeFetch(url, { headers: apiHeaders() })

  if (!res.ok) {
    throw new Error(`Failed to list workflows: HTTP ${res.status}`)
  }

  const json = await res.json()
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
  let url = `${N8N_URL}/api/v1/executions?limit=${limit}`
  if (workflowId) {
    url += `&workflowId=${workflowId}`
  }

  const res = await safeFetch(url, { headers: apiHeaders() })

  if (!res.ok) {
    throw new Error(`Failed to get executions: HTTP ${res.status}`)
  }

  const json = await res.json()
  return (json.data || json || []).map((ex) => ({
    id: ex.id,
    workflowId: ex.workflowId,
    workflowName: ex.workflowData?.name || null,
    status: ex.status || (ex.finished ? 'success' : 'running'),
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
    const res = await safeFetch(`${N8N_URL}/healthz`, {}, 5000)
    return { online: res.ok, url: N8N_URL }
  } catch {
    return { online: false, url: N8N_URL }
  }
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
  getExecutions,
  checkHealth,
  WORKFLOW_MODULES,
}
