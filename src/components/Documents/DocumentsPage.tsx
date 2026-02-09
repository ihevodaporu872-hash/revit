import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Send, ClipboardList, FileCheck2,
  MessageSquareText, Clock, AlertTriangle, Search,
  Download, Eye, Sparkles, Loader2
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Table } from '../ui/Table'
import { Tabs } from '../ui/Tabs'
import { FileUpload } from '../ui/FileUpload'
import { formatDate } from '../../lib/utils'
import type { Document, RFI, Submittal } from '../../services/api'
import {
  getDocuments,
  uploadDocument,
  getRFIs,
  createRFI,
  getSubmittals,
  generateMeetingMinutes,
} from '../../services/api'
import { MotionPage } from '../MotionPage'
import {
  staggerContainer,
  fadeInUp,
  scaleIn,
  listItem,
  modalOverlay,
  modalContent,
} from '../../lib/animations'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: (Document & Record<string, unknown>)[] = [
  { id: '1', name: 'Structural Drawings Rev C', type: 'Drawing', status: 'Approved', author: 'John Eng', date: '2026-01-15', version: '3.0', fileSize: 45200000, downloadUrl: '#' },
  { id: '2', name: 'MEP Coordination Report', type: 'Report', status: 'Review', author: 'Sarah MEP', date: '2026-01-28', version: '1.2', fileSize: 12800000, downloadUrl: '#' },
  { id: '3', name: 'Foundation Spec Sheet', type: 'Specification', status: 'Draft', author: 'Mike Arch', date: '2026-02-01', version: '0.3', fileSize: 3400000, downloadUrl: '#' },
  { id: '4', name: 'Safety Plan Q1 2026', type: 'Plan', status: 'Approved', author: 'Lisa Safety', date: '2026-01-10', version: '2.0', fileSize: 8700000, downloadUrl: '#' },
  { id: '5', name: 'Facade Material Submittal', type: 'Submittal', status: 'Rejected', author: 'Tom Ext', date: '2026-02-03', version: '1.0', fileSize: 22100000, downloadUrl: '#' },
  { id: '6', name: 'HVAC Layout Floor 3-5', type: 'Drawing', status: 'Review', author: 'Sarah MEP', date: '2026-02-05', version: '1.1', fileSize: 38900000, downloadUrl: '#' },
]

const MOCK_RFIS: (RFI & Record<string, unknown>)[] = [
  { id: '1', number: 'RFI-001', subject: 'Column grid alignment at Level 3', status: 'Open', priority: 'High', dueDate: '2026-02-10', assignedTo: 'John Eng', createdBy: 'Mike Arch', createdAt: '2026-01-20' },
  { id: '2', number: 'RFI-002', subject: 'Waterproofing specification for basement', status: 'Answered', priority: 'Medium', dueDate: '2026-02-05', assignedTo: 'Sarah MEP', createdBy: 'Tom Ext', createdAt: '2026-01-22' },
  { id: '3', number: 'RFI-003', subject: 'Fire rating requirement for stairwell doors', status: 'Open', priority: 'Critical', dueDate: '2026-02-08', assignedTo: 'Lisa Safety', createdBy: 'Mike Arch', createdAt: '2026-01-25' },
  { id: '4', number: 'RFI-004', subject: 'Electrical conduit routing through beam', status: 'Overdue', priority: 'High', dueDate: '2026-01-30', assignedTo: 'John Eng', createdBy: 'Sarah MEP', createdAt: '2026-01-15' },
  { id: '5', number: 'RFI-005', subject: 'Concrete mix design for exposed aggregate', status: 'Closed', priority: 'Low', dueDate: '2026-02-15', assignedTo: 'Tom Ext', createdBy: 'John Eng', createdAt: '2026-01-28' },
]

const MOCK_SUBMITTALS: (Submittal & Record<string, unknown>)[] = [
  { id: '1', number: 'SUB-001', description: 'Reinforcing Steel Shop Drawings', status: 'Approved', specSection: '03 21 00', dueDate: '2026-01-20', contractor: 'SteelWorks Inc.', createdAt: '2026-01-05' },
  { id: '2', number: 'SUB-002', description: 'Curtain Wall System Samples', status: 'Submitted', specSection: '08 44 13', dueDate: '2026-02-15', contractor: 'GlassFab Ltd.', createdAt: '2026-01-18' },
  { id: '3', number: 'SUB-003', description: 'HVAC Equipment Cut Sheets', status: 'Pending', specSection: '23 05 00', dueDate: '2026-02-20', contractor: 'AirFlow Corp.', createdAt: '2026-01-22' },
  { id: '4', number: 'SUB-004', description: 'Elevator Cab Finishes', status: 'Resubmit', specSection: '14 21 00', dueDate: '2026-02-10', contractor: 'Vertical Transit Co.', createdAt: '2026-01-12' },
  { id: '5', number: 'SUB-005', description: 'Waterproofing Membrane Data', status: 'Rejected', specSection: '07 10 00', dueDate: '2026-02-08', contractor: 'SealTight LLC', createdAt: '2026-01-25' },
]

// ─── File type icon color map ─────────────────────────────────────────────────

const fileTypeIconColor: Record<string, string> = {
  Drawing: 'text-primary',
  Report: 'text-warning',
  Specification: 'text-success',
  Plan: 'text-info',
  Submittal: 'text-chart-3',
}

// ─── Submittal status indicator dot colors ────────────────────────────────────

const submittalStatusDotColor: Record<Submittal['status'], string> = {
  Pending: 'bg-primary',
  Submitted: 'bg-info',
  Approved: 'bg-success',
  Rejected: 'bg-destructive',
  Resubmit: 'bg-warning',
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

function docStatusBadge(status: Document['status']) {
  const map: Record<Document['status'], 'success' | 'warning' | 'primary' | 'danger'> = {
    Approved: 'success', Review: 'warning', Draft: 'primary', Rejected: 'danger',
  }
  return <Badge variant={map[status]}>{status}</Badge>
}

function rfiStatusBadge(status: RFI['status']) {
  const map: Record<RFI['status'], 'primary' | 'success' | 'default' | 'danger'> = {
    Open: 'primary', Answered: 'success', Closed: 'default', Overdue: 'danger',
  }
  return <Badge variant={map[status]}>{status}</Badge>
}

function rfiPriorityBadge(priority: RFI['priority']) {
  const map: Record<RFI['priority'], 'default' | 'info' | 'warning' | 'danger'> = {
    Low: 'default', Medium: 'info', High: 'warning', Critical: 'danger',
  }
  return <Badge variant={map[priority]}>{priority}</Badge>
}

function submittalStatusBadge(status: Submittal['status']) {
  const map: Record<Submittal['status'], 'primary' | 'info' | 'success' | 'danger' | 'warning'> = {
    Pending: 'primary', Submitted: 'info', Approved: 'success', Rejected: 'danger', Resubmit: 'warning',
  }
  return <Badge variant={map[status]}>{status}</Badge>
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DocumentsTab() {
  const [documents, setDocuments] = useState(MOCK_DOCUMENTS)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.author.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      await uploadDocument(formData)
      const updated = await getDocuments()
      setDocuments(updated as typeof documents)
    } catch {
      // Fallback: add locally with mock data
      const newDocs = files.map((f, i) => ({
        id: String(documents.length + i + 1),
        name: f.name,
        type: f.name.endsWith('.pdf') ? 'Report' : 'Drawing',
        status: 'Draft' as const,
        author: 'Current User',
        date: new Date().toISOString().split('T')[0],
        version: '1.0',
        fileSize: f.size,
        downloadUrl: '#',
      }))
      setDocuments([...newDocs, ...documents])
    } finally {
      setUploading(false)
      setShowUpload(false)
    }
  }, [documents])

  const columns = [
    { key: 'name', header: 'Name', render: (d: typeof documents[0]) => (
      <div className="flex items-center gap-2">
        <FileText size={16} className={`${fileTypeIconColor[d.type as string] || 'text-primary'} shrink-0`} />
        <span className="font-medium">{d.name}</span>
      </div>
    )},
    { key: 'type', header: 'Type' },
    { key: 'status', header: 'Status', render: (d: typeof documents[0]) => docStatusBadge(d.status) },
    { key: 'author', header: 'Author' },
    { key: 'date', header: 'Date', render: (d: typeof documents[0]) => formatDate(d.date) },
    { key: 'version', header: 'Version', render: (d: typeof documents[0]) => (
      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">v{d.version}</span>
    )},
    { key: 'actions', header: '', render: () => (
      <div className="flex items-center gap-1">
        <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Preview">
          <Eye size={14} className="text-muted-foreground" />
        </button>
        <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Download">
          <Download size={14} className="text-muted-foreground" />
        </button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowUpload(!showUpload)}>
          Upload Document
        </Button>
      </div>

      <AnimatePresence>
        {showUpload && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <Card hover>
              <FileUpload
                accept=".pdf,.dwg,.ifc,.xlsx,.docx,.png,.jpg"
                multiple
                onFilesSelected={handleUpload}
                label="Upload project documents"
                description="PDF, DWG, IFC, Excel, Word, Images up to 500MB"
              />
              {uploading && (
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Uploading...
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card hover>
        <Table columns={columns} data={filtered} emptyMessage="No documents found" />
      </Card>
    </div>
  )
}

function RFITab() {
  const [rfis, setRfis] = useState(MOCK_RFIS)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    priority: 'Medium' as RFI['priority'],
    assignedTo: '',
    dueDate: '',
  })

  const handleCreate = useCallback(async () => {
    if (!form.subject.trim() || !form.assignedTo.trim()) return
    setSubmitting(true)
    try {
      await createRFI({
        subject: form.subject,
        priority: form.priority,
        assignedTo: form.assignedTo,
        dueDate: form.dueDate,
      })
      const updated = await getRFIs()
      setRfis(updated as typeof rfis)
    } catch {
      // Fallback: add locally
      const newRFI: typeof rfis[0] = {
        id: String(rfis.length + 1),
        number: `RFI-${String(rfis.length + 1).padStart(3, '0')}`,
        subject: form.subject,
        status: 'Open',
        priority: form.priority,
        dueDate: form.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        assignedTo: form.assignedTo,
        createdBy: 'Current User',
        createdAt: new Date().toISOString().split('T')[0],
      }
      setRfis([newRFI, ...rfis])
    } finally {
      setSubmitting(false)
      setShowForm(false)
      setForm({ subject: '', priority: 'Medium', assignedTo: '', dueDate: '' })
    }
  }, [form, rfis])

  const columns = [
    { key: 'number', header: 'Number', render: (r: typeof rfis[0]) => (
      <span className="font-mono font-medium text-primary">{r.number}</span>
    )},
    { key: 'subject', header: 'Subject' },
    { key: 'status', header: 'Status', render: (r: typeof rfis[0]) => rfiStatusBadge(r.status) },
    { key: 'priority', header: 'Priority', render: (r: typeof rfis[0]) => rfiPriorityBadge(r.priority) },
    { key: 'dueDate', header: 'Due Date', render: (r: typeof rfis[0]) => formatDate(r.dueDate) },
    { key: 'assignedTo', header: 'Assigned To' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tracking {rfis.filter((r) => r.status === 'Open' || r.status === 'Overdue').length} open RFIs
        </p>
        <Button icon={<Plus size={16} />} onClick={() => setShowForm(!showForm)}>
          New RFI
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <Card title="Create New RFI" hover>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Describe the request for information..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as RFI['priority'] })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Assigned To</label>
                  <input
                    type="text"
                    value={form.assignedTo}
                    onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    placeholder="Name of assignee"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreate} loading={submitting} icon={<Send size={16} />}>
                    Create RFI
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card hover>
        <Table columns={columns} data={rfis} emptyMessage="No RFIs found" />
      </Card>
    </div>
  )
}

function SubmittalsTab() {
  const [submittals] = useState(MOCK_SUBMITTALS)

  const columns = [
    { key: 'number', header: 'Number', render: (s: typeof submittals[0]) => (
      <span className="font-mono font-medium text-primary">{s.number}</span>
    )},
    { key: 'description', header: 'Description' },
    { key: 'status', header: 'Status', render: (s: typeof submittals[0]) => (
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${submittalStatusDotColor[s.status]} shrink-0`} />
        {submittalStatusBadge(s.status)}
      </div>
    )},
    { key: 'specSection', header: 'Spec Section', render: (s: typeof submittals[0]) => (
      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{s.specSection}</span>
    )},
    { key: 'dueDate', header: 'Due Date', render: (s: typeof submittals[0]) => formatDate(s.dueDate) },
    { key: 'contractor', header: 'Contractor' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {submittals.filter((s) => s.status === 'Pending' || s.status === 'Submitted').length} submittals awaiting action
        </p>
      </div>
      <Card hover>
        <Table columns={columns} data={submittals} emptyMessage="No submittals found" />
      </Card>
    </div>
  )
}

function MeetingMinutesTab() {
  const [notes, setNotes] = useState('')
  const [minutes, setMinutes] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!notes.trim()) return
    setGenerating(true)
    setMinutes('')
    try {
      const result = await generateMeetingMinutes(notes)
      setMinutes(result)
    } catch {
      // Fallback: generate a structured mock response
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
      setMinutes(
`MEETING MINUTES
================
Date: ${timestamp}
Project: Jens Construction Platform
Generated by: Jens AI

ATTENDEES
---------
(Extracted from notes)

AGENDA & DISCUSSION
-------------------
${notes.split('\n').filter(Boolean).map((line, i) => `${i + 1}. ${line.trim()}`).join('\n')}

ACTION ITEMS
------------
- [ ] Review discussed items and assign responsibilities
- [ ] Follow up on open questions before next meeting
- [ ] Distribute minutes to all stakeholders

NEXT MEETING
------------
To be scheduled.

---
These minutes were auto-generated by Jens AI from meeting notes.
Review and edit as needed before distribution.`
      )
    } finally {
      setGenerating(false)
    }
  }, [notes])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Meeting Notes" subtitle="Enter raw notes from the meeting" hover>
        <div className="space-y-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={"Enter meeting notes here...\n\nExample:\n- Discussed foundation schedule\n- John to review structural calcs by Friday\n- HVAC coordination meeting next Tuesday\n- Budget review: $2.3M spent of $5M budget\n- Safety incident report: zero incidents this month"}
            rows={16}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono"
          />
          <Button
            onClick={handleGenerate}
            loading={generating}
            disabled={!notes.trim()}
            icon={<Sparkles size={16} />}
            size="lg"
            className="w-full"
          >
            Generate Meeting Minutes
          </Button>
        </div>
      </Card>

      <Card title="Formatted Minutes" subtitle="AI-generated meeting minutes preview" hover>
        {minutes ? (
          <div className="space-y-4">
            <AnimatePresence>
              <motion.pre
                key="minutes-output"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                className="whitespace-pre-wrap text-sm text-foreground font-mono bg-muted p-4 rounded-lg border border-border max-h-[500px] overflow-y-auto leading-relaxed"
              >
                {minutes}
              </motion.pre>
            </AnimatePresence>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={14} />}
                onClick={() => {
                  const blob = new Blob([minutes], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `meeting-minutes-${new Date().toISOString().split('T')[0]}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Download TXT
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(minutes)
                }}
              >
                Copy to Clipboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquareText size={48} className="mb-3 opacity-40" />
            <p className="font-medium">No minutes generated yet</p>
            <p className="text-sm mt-1">Enter your meeting notes and click Generate</p>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const totalDocs = MOCK_DOCUMENTS.length
  const pendingRFIs = MOCK_RFIS.filter((r) => r.status === 'Open' || r.status === 'Overdue').length
  const openSubmittals = MOCK_SUBMITTALS.filter((s) => s.status === 'Pending' || s.status === 'Submitted').length
  const overdueItems =
    MOCK_RFIS.filter((r) => r.status === 'Overdue').length +
    MOCK_SUBMITTALS.filter((s) => new Date(s.dueDate) < new Date() && s.status !== 'Approved').length

  const tabs = [
    { id: 'documents', label: 'Documents', icon: <FileText size={16} /> },
    { id: 'rfis', label: 'RFIs', icon: <ClipboardList size={16} /> },
    { id: 'submittals', label: 'Submittals', icon: <FileCheck2 size={16} /> },
    { id: 'minutes', label: 'Meeting Minutes', icon: <MessageSquareText size={16} /> },
  ]

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Control</h1>
          <p className="text-muted-foreground mt-1">
            Manage project documents, RFIs, submittals, and generate meeting minutes
          </p>
        </div>

        {/* Stats */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            label="Total Documents"
            value={totalDocs}
            icon={FileText}
            color="primary"
          />
          <StatCard
            label="Pending RFIs"
            value={pendingRFIs}
            icon={ClipboardList}
            color="warning"
            trend={{ value: -12, label: 'vs last month' }}
          />
          <StatCard
            label="Open Submittals"
            value={openSubmittals}
            icon={FileCheck2}
            color="success"
          />
          <StatCard
            label="Overdue Items"
            value={overdueItems}
            icon={AlertTriangle}
            color="danger"
            trend={{ value: 5, label: 'vs last week' }}
          />
        </motion.div>

        {/* Tabs */}
        <Tabs tabs={tabs} defaultTab="documents">
          {(activeTab) => (
            <>
              {activeTab === 'documents' && <DocumentsTab />}
              {activeTab === 'rfis' && <RFITab />}
              {activeTab === 'submittals' && <SubmittalsTab />}
              {activeTab === 'minutes' && <MeetingMinutesTab />}
            </>
          )}
        </Tabs>
      </div>
    </MotionPage>
  )
}
