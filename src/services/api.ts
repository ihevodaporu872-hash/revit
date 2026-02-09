// Jens Construction Platform — API Service Layer

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversionResult {
  id: string
  outputFile: string
  outputFormat: string
  fileSize: number
  duration: number
  downloadUrl: string
  createdAt: string
}

export interface ConversionRecord {
  id: string
  inputFile: string
  inputFormat: string
  outputFormat: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  fileSize: number
  duration: number
  downloadUrl: string
  createdAt: string
}

export interface WorkItem {
  id: string
  code: string
  description: string
  unit: string
  unitPrice: number
  category: string
  subcategory: string
  region: string
}

export interface ClassifiedElement {
  elementId: string
  elementType: string
  name: string
  material: string
  quantity: number
  unit: string
  matchedWorkItem: WorkItem | null
  confidence: number
}

export interface CostItem {
  elementId: string
  workItemCode: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
}

export interface CostReport {
  id: string
  totalCost: number
  currency: string
  items: Array<CostItem & { totalPrice: number }>
  categories: Array<{ name: string; total: number; percentage: number }>
  createdAt: string
}

export interface ValidationRule {
  id: string
  name: string
  description: string
  category: string
}

export interface ValidationIssue {
  ruleId: string
  ruleName: string
  severity: 'error' | 'warning' | 'info'
  elementId: string
  elementType: string
  message: string
  location?: string
}

export interface ValidationResult {
  id: string
  totalElements: number
  checkedRules: number
  issues: ValidationIssue[]
  passRate: number
  summary: {
    errors: number
    warnings: number
    info: number
  }
  createdAt: string
}

export interface AnalysisResult {
  id: string
  prompt: string
  response: string
  charts?: Array<{
    type: 'bar' | 'pie' | 'line'
    title: string
    data: Record<string, unknown>[]
  }>
  tables?: Array<{
    title: string
    headers: string[]
    rows: string[][]
  }>
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee: string
  dueDate: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  name: string
  type: string
  status: 'Draft' | 'Review' | 'Approved' | 'Rejected'
  author: string
  date: string
  version: string
  fileSize: number
  downloadUrl: string
}

export interface RFI {
  id: string
  number: string
  subject: string
  status: 'Open' | 'Answered' | 'Closed' | 'Overdue'
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  dueDate: string
  assignedTo: string
  createdBy: string
  createdAt: string
  response?: string
}

export interface Submittal {
  id: string
  number: string
  description: string
  status: 'Pending' | 'Submitted' | 'Approved' | 'Rejected' | 'Resubmit'
  specSection: string
  dueDate: string
  contractor: string
  createdAt: string
}

export interface QTOOptions {
  groupBy: 'type' | 'floor' | 'phase' | 'detailed'
  includeQuantities: boolean
  includeCost: boolean
  currency?: string
}

export interface QTOElement {
  id: string
  name: string
  type: string
  floor: string
  phase: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
  material: string
  dimensions: string
}

export interface QTOCategory {
  name: string
  elementCount: number
  totalQuantity: number
  unit: string
  totalCost: number
  elements: QTOElement[]
}

export interface QTOReport {
  id: string
  fileName: string
  groupBy: string
  categories: QTOCategory[]
  summary: {
    totalElements: number
    totalCategories: number
    totalFloors: number
    estimatedCost: number
    currency: string
  }
  createdAt: string
}

export interface QTOReportRecord {
  id: string
  fileName: string
  groupBy: string
  totalElements: number
  estimatedCost: number
  createdAt: string
}

// ─── Error Helper ─────────────────────────────────────────────────────────────

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => 'Unknown error')
    throw new ApiError(body || `Request failed with status ${response.status}`, response.status)
  }
  return response.json()
}

// ─── Converter ────────────────────────────────────────────────────────────────

export async function convertFile(formData: FormData): Promise<ConversionResult> {
  const response = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse<ConversionResult>(response)
}

export async function getConversionHistory(): Promise<ConversionRecord[]> {
  const response = await fetch(`${API_BASE}/convert/history`)
  return handleResponse<ConversionRecord[]>(response)
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

export async function searchCWICR(query: string, language: string): Promise<WorkItem[]> {
  const response = await fetch(`${API_BASE}/cost/search?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(language)}`)
  return handleResponse<WorkItem[]>(response)
}

export async function classifyElements(formData: FormData): Promise<ClassifiedElement[]> {
  const response = await fetch(`${API_BASE}/cost/classify`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse<ClassifiedElement[]>(response)
}

export async function calculateCost(items: CostItem[]): Promise<CostReport> {
  const response = await fetch(`${API_BASE}/cost/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  return handleResponse<CostReport>(response)
}

// ─── Validation ───────────────────────────────────────────────────────────────

export async function validateBIM(formData: FormData, rules: string[]): Promise<ValidationResult> {
  rules.forEach((rule) => formData.append('rules', rule))
  const response = await fetch(`${API_BASE}/validation/check`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse<ValidationResult>(response)
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

export async function analyzeData(formData: FormData, prompt: string): Promise<AnalysisResult> {
  formData.append('prompt', prompt)
  const response = await fetch(`${API_BASE}/ai/analyze`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse<AnalysisResult>(response)
}

// ─── Project Management ───────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  const response = await fetch(`${API_BASE}/tasks`)
  return handleResponse<Task[]>(response)
}

export async function createTask(task: Partial<Task>): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
  return handleResponse<Task>(response)
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  return handleResponse<Task>(response)
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocuments(): Promise<Document[]> {
  const response = await fetch(`${API_BASE}/documents`)
  return handleResponse<Document[]>(response)
}

export async function uploadDocument(formData: FormData): Promise<Document> {
  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse<Document>(response)
}

export async function getRFIs(): Promise<RFI[]> {
  const response = await fetch(`${API_BASE}/documents/rfis`)
  return handleResponse<RFI[]>(response)
}

export async function createRFI(rfi: Partial<RFI>): Promise<RFI> {
  const response = await fetch(`${API_BASE}/documents/rfis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rfi),
  })
  return handleResponse<RFI>(response)
}

export async function getSubmittals(): Promise<Submittal[]> {
  const response = await fetch(`${API_BASE}/documents/submittals`)
  return handleResponse<Submittal[]>(response)
}

export async function generateMeetingMinutes(notes: string): Promise<string> {
  const response = await fetch(`${API_BASE}/documents/meeting-minutes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  const data = await handleResponse<{ minutes: string }>(response)
  return data.minutes
}

// ─── QTO Reports ──────────────────────────────────────────────────────────────

export async function generateQTO(formData: FormData, options: QTOOptions): Promise<QTOReport> {
  formData.append('groupBy', options.groupBy)
  formData.append('includeQuantities', String(options.includeQuantities))
  formData.append('includeCost', String(options.includeCost))
  if (options.currency) formData.append('currency', options.currency)
  const response = await fetch(`${API_BASE}/qto/generate`, {
    method: 'POST',
    body: formData,
  })
  return handleResponse<QTOReport>(response)
}

export async function getQTOHistory(): Promise<QTOReportRecord[]> {
  const response = await fetch(`${API_BASE}/qto/history`)
  return handleResponse<QTOReportRecord[]>(response)
}

// ─── Gemini AI ────────────────────────────────────────────────────────────────

export async function askGemini(prompt: string, context?: string): Promise<string> {
  const response = await fetch(`${API_BASE}/ai/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, context }),
  })
  const data = await handleResponse<{ response: string }>(response)
  return data.response
}

// ─── n8n Integration ─────────────────────────────────────────────────────────

export interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
  tags: string[]
}

export interface N8nExecution {
  id: string
  workflowId: string
  workflowName: string | null
  status: string
  startedAt: string
  stoppedAt: string | null
  mode: string
}

export async function getN8nHealth(): Promise<{ online: boolean; url: string }> {
  const response = await fetch(`${API_BASE}/n8n/health`)
  return handleResponse<{ online: boolean; url: string }>(response)
}

export async function getN8nWorkflows(): Promise<N8nWorkflow[]> {
  const response = await fetch(`${API_BASE}/n8n/workflows`)
  return handleResponse<N8nWorkflow[]>(response)
}

export async function getN8nExecutions(workflowId?: string, limit = 20): Promise<N8nExecution[]> {
  let url = `${API_BASE}/n8n/executions?limit=${limit}`
  if (workflowId) url += `&workflowId=${workflowId}`
  const response = await fetch(url)
  return handleResponse<N8nExecution[]>(response)
}

export async function getN8nExecutionStatus(executionId: string): Promise<N8nExecution> {
  const response = await fetch(`${API_BASE}/n8n/status/${encodeURIComponent(executionId)}`)
  return handleResponse<N8nExecution>(response)
}

export async function triggerN8nWorkflow(webhookPath: string, data: Record<string, unknown> = {}): Promise<unknown> {
  const response = await fetch(`${API_BASE}/n8n/trigger/${encodeURIComponent(webhookPath)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<unknown>(response)
}
