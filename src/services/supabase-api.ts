// Jens Construction Platform — Supabase CRUD Service Layer

import { supabase } from '../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────────

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camelKey] = value
  }
  return result
}

function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
    result[snakeKey] = value
  }
  return result
}

// ── Tasks ──────────────────────────────────────────────────────────────────────

export async function fetchTasks() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Supabase] fetchTasks:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status === 'in_progress' ? 'in_progress' : row.status,
    priority: row.priority,
    assignee: row.assignee,
    dueDate: row.due_date,
    tags: row.tags || [],
    module: row.module,
    comments: [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at,
  }))
}

export async function createTask(task: {
  title: string
  description?: string
  status?: string
  priority?: string
  assignee?: string
  dueDate?: string
  tags?: string[]
  module?: string
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: task.title,
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      assignee: task.assignee || 'Unassigned',
      due_date: task.dueDate || null,
      tags: task.tags || [],
      module: task.module || 'general',
    })
    .select()
    .single()
  if (error) { console.error('[Supabase] createTask:', error.message); return null }
  return data
}

export async function updateTask(id: string, updates: Record<string, unknown>) {
  if (!supabase) return null
  const snakeUpdates = camelToSnake(updates)
  // Map common camelCase field names
  if ('dueDate' in updates) { snakeUpdates.due_date = updates.dueDate; delete snakeUpdates.due_date === undefined }
  const { data, error } = await supabase
    .from('tasks')
    .update(snakeUpdates)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('[Supabase] updateTask:', error.message); return null }
  return data
}

export async function addTaskComment(taskId: string, author: string, text: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, author, text })
    .select()
    .single()
  if (error) { console.error('[Supabase] addTaskComment:', error.message); return null }
  return data
}

export async function fetchTaskComments(taskId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) { console.error('[Supabase] fetchTaskComments:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    author: row.author,
    text: row.text,
    timestamp: new Date(row.created_at).getTime(),
  }))
}

// ── Documents ──────────────────────────────────────────────────────────────────

export async function fetchDocuments() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Supabase] fetchDocuments:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    author: row.author,
    date: row.created_at?.split('T')[0] || '',
    version: row.version,
    fileSize: row.file_size,
    downloadUrl: row.download_url || '#',
  }))
}

// ── RFIs ───────────────────────────────────────────────────────────────────────

export async function fetchRFIs() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('rfis')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Supabase] fetchRFIs:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    number: row.number,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    createdAt: row.created_at?.split('T')[0] || '',
  }))
}

export async function createRFI(rfi: {
  subject: string
  priority?: string
  assignedTo?: string
  dueDate?: string
}) {
  if (!supabase) return null
  // Get next RFI number
  const { data: existing } = await supabase
    .from('rfis')
    .select('number')
    .order('created_at', { ascending: false })
    .limit(1)
  const lastNum = existing?.[0]?.number
    ? parseInt(existing[0].number.replace('RFI-', ''))
    : 0
  const nextNumber = `RFI-${String(lastNum + 1).padStart(3, '0')}`

  const { data, error } = await supabase
    .from('rfis')
    .insert({
      number: nextNumber,
      subject: rfi.subject,
      priority: rfi.priority || 'Medium',
      assigned_to: rfi.assignedTo || '',
      created_by: 'Current User',
      due_date: rfi.dueDate || null,
    })
    .select()
    .single()
  if (error) { console.error('[Supabase] createRFI:', error.message); return null }
  return data
}

// ── Submittals ─────────────────────────────────────────────────────────────────

export async function fetchSubmittals() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('submittals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Supabase] fetchSubmittals:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    number: row.number,
    description: row.title,
    status: row.status,
    specSection: row.spec_section,
    dueDate: row.due_date,
    contractor: row.submitted_by,
    createdAt: row.created_at?.split('T')[0] || '',
  }))
}

// ── Conversion History ─────────────────────────────────────────────────────────

export async function fetchConversionHistory() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('conversion_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) { console.error('[Supabase] fetchConversionHistory:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    inputFormat: row.input_format,
    outputFormat: row.output_format,
    status: row.status,
    createdAt: row.created_at,
    duration: row.duration || '—',
    fileSize: row.file_size || '',
  }))
}

export async function saveConversionRecord(record: {
  fileName: string
  inputFormat: string
  outputFormat: string
  status: string
  fileSize?: string
  duration?: string
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('conversion_history')
    .insert({
      file_name: record.fileName,
      input_format: record.inputFormat,
      output_format: record.outputFormat,
      status: record.status,
      file_size: record.fileSize || '',
      duration: record.duration || '',
    })
    .select()
    .single()
  if (error) { console.error('[Supabase] saveConversionRecord:', error.message); return null }
  return data
}

// ── Cost Estimates ─────────────────────────────────────────────────────────────

export async function fetchCostEstimates() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('cost_estimates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Supabase] fetchCostEstimates:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    itemCount: row.item_count,
    totalCost: Number(row.total_cost),
    createdAt: row.created_at,
    language: row.language,
  }))
}

export async function saveCostEstimate(estimate: {
  name: string
  itemCount: number
  totalCost: number
  language?: string
  items?: unknown[]
  summary?: unknown
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('cost_estimates')
    .insert({
      name: estimate.name,
      item_count: estimate.itemCount,
      total_cost: estimate.totalCost,
      language: estimate.language || 'EN',
      items: estimate.items || [],
      summary: estimate.summary || {},
    })
    .select()
    .single()
  if (error) { console.error('[Supabase] saveCostEstimate:', error.message); return null }
  return data
}

// ── Validation Results ─────────────────────────────────────────────────────────

export async function saveValidationResult(result: {
  fileName: string
  overallScore: number
  summary: unknown
  ruleResults: unknown[]
  issues: unknown[]
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('validation_results')
    .insert({
      file_name: result.fileName,
      overall_score: result.overallScore,
      summary: result.summary,
      rule_results: result.ruleResults,
      issues: result.issues,
    })
    .select()
    .single()
  if (error) { console.error('[Supabase] saveValidationResult:', error.message); return null }
  return data
}

// ── QTO Reports ────────────────────────────────────────────────────────────────

export async function fetchQTOHistory() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('qto_reports')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Supabase] fetchQTOHistory:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    groupBy: row.group_by,
    totalElements: row.total_elements || row.summary?.totalElements || 0,
    estimatedCost: row.summary?.estimatedCost || 0,
    createdAt: row.created_at,
  }))
}

export async function saveQTOReport(report: {
  fileName: string
  groupBy: string
  categories?: unknown[]
  summary: unknown
  totalElements: number
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('qto_reports')
    .insert({
      file_name: report.fileName,
      group_by: report.groupBy,
      categories: report.categories || [],
      summary: report.summary,
      total_elements: report.totalElements,
    })
    .select()
    .single()
  if (error) { console.error('[Supabase] saveQTOReport:', error.message); return null }
  return data
}

// ── Revit Properties (IFC Element Enrichment) ─────────────────────────────────

import type { RevitProperties } from '../components/Viewer3D/ifc/types'

export async function fetchRevitProperties(globalId: string, projectId = 'default'): Promise<RevitProperties | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('ifc_element_properties')
    .select('*')
    .eq('global_id', globalId)
    .eq('project_id', projectId)
    .single()
  if (error || !data) return null
  return snakeToCamel(data) as unknown as RevitProperties
}

export async function fetchRevitPropertiesBulk(globalIds: string[], projectId = 'default'): Promise<Map<string, RevitProperties>> {
  const map = new Map<string, RevitProperties>()
  if (!supabase || globalIds.length === 0) return map

  // Supabase .in() has a limit, batch in chunks of 500
  const chunkSize = 500
  for (let i = 0; i < globalIds.length; i += chunkSize) {
    const chunk = globalIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('ifc_element_properties')
      .select('*')
      .eq('project_id', projectId)
      .in('global_id', chunk)
    if (error || !data) continue
    for (const row of data) {
      const camel = snakeToCamel(row) as unknown as RevitProperties
      map.set(row.global_id, camel)
    }
  }
  return map
}

export async function fetchRevitPropertiesByElementIds(elementIds: number[], projectId = 'default'): Promise<Map<number, RevitProperties>> {
  const map = new Map<number, RevitProperties>()
  if (!supabase || elementIds.length === 0) return map

  const chunkSize = 500
  for (let i = 0; i < elementIds.length; i += chunkSize) {
    const chunk = elementIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('ifc_element_properties')
      .select('*')
      .eq('project_id', projectId)
      .in('revit_element_id', chunk)
    if (error || !data) continue
    for (const row of data) {
      const camel = snakeToCamel(row) as unknown as RevitProperties
      if (row.revit_element_id) map.set(row.revit_element_id, camel)
    }
  }
  return map
}

// ── Chat Sessions ──────────────────────────────────────────────────────────────

export async function fetchChatSessions() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) { console.error('[Supabase] fetchChatSessions:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    messages: row.messages || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function saveChatSession(session: {
  id?: string
  title: string
  fileName?: string
  messages: unknown[]
}) {
  if (!supabase) return null
  if (session.id) {
    // Update existing
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({
        title: session.title,
        file_name: session.fileName || null,
        messages: session.messages,
      })
      .eq('id', session.id)
      .select()
      .single()
    if (error) { console.error('[Supabase] saveChatSession update:', error.message); return null }
    return data
  }
  // Insert new
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      title: session.title,
      file_name: session.fileName || null,
      messages: session.messages,
    })
    .select()
    .single()
  if (error) { console.error('[Supabase] saveChatSession insert:', error.message); return null }
  return data
}

// ── n8n Results ─────────────────────────────────────────────────────────────

export async function fetchN8nResults(module?: string, limit = 50) {
  if (!supabase) return []
  let query = supabase
    .from('n8n_results')
    .select('*')
    .order('created_at', { ascending: false })
  if (module) query = query.eq('module', module)
  query = query.limit(limit)
  const { data, error } = await query
  if (error) { console.error('[Supabase] fetchN8nResults:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    executionId: row.execution_id,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    module: row.module,
    status: row.status,
    inputData: row.input_data,
    outputData: row.output_data,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  }))
}

// ── n8n Cost Estimates ──────────────────────────────────────────────────────

export async function fetchN8nCostEstimates(source?: string, limit = 50) {
  if (!supabase) return []
  let query = supabase
    .from('n8n_cost_estimates')
    .select('*')
    .order('created_at', { ascending: false })
  if (source) query = query.eq('source', source)
  query = query.limit(limit)
  const { data, error } = await query
  if (error) { console.error('[Supabase] fetchN8nCostEstimates:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    source: row.source,
    queryText: row.query_text,
    photoUrl: row.photo_url,
    language: row.language,
    items: row.items || [],
    totalCost: Number(row.total_cost),
    currency: row.currency,
    region: row.region,
    confidence: row.confidence ? Number(row.confidence) : null,
    rawResponse: row.raw_response,
    createdAt: row.created_at,
  }))
}

// ── Field Reports ───────────────────────────────────────────────────────────

export async function fetchFieldReports(taskId?: string, limit = 50) {
  if (!supabase) return []
  let query = supabase
    .from('field_reports')
    .select('*')
    .order('created_at', { ascending: false })
  if (taskId) query = query.eq('task_id', taskId)
  query = query.limit(limit)
  const { data, error } = await query
  if (error) { console.error('[Supabase] fetchFieldReports:', error.message); return [] }
  return (data || []).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    reporter: row.reporter,
    description: row.description,
    photoUrls: row.photo_urls || [],
    gpsLat: row.gps_lat ? Number(row.gps_lat) : null,
    gpsLon: row.gps_lon ? Number(row.gps_lon) : null,
    address: row.address,
    reportType: row.report_type,
    metadata: row.metadata,
    createdAt: row.created_at,
  }))
}

// ── Worker Locations ────────────────────────────────────────────────────────

export async function fetchWorkerLocations() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('worker_locations')
    .select('*')
    .order('worker_name', { ascending: true })
    .order('recorded_at', { ascending: false })
  if (error) { console.error('[Supabase] fetchWorkerLocations:', error.message); return [] }
  // Deduplicate: latest per worker
  const latest = new Map<string, typeof data[0]>()
  for (const row of (data || [])) {
    if (!latest.has(row.worker_name)) latest.set(row.worker_name, row)
  }
  return [...latest.values()].map((row) => ({
    id: row.id,
    workerName: row.worker_name,
    lat: Number(row.lat),
    lon: Number(row.lon),
    accuracy: row.accuracy ? Number(row.accuracy) : null,
    recordedAt: row.recorded_at,
    metadata: row.metadata,
  }))
}
