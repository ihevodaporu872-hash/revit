import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchTasks, createTask as sbCreateTask, updateTask as sbUpdateTask, addTaskComment as sbAddComment } from '../../services/supabase-api'
import {
  LayoutDashboard,
  Plus,
  GripVertical,
  Calendar,
  User,
  MessageSquare,
  Tag,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  ListTodo,
  Filter,
  ChevronDown,
  ChevronUp,
  Send as SendIcon,
  BotMessageSquare,
  ArrowRight,
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useAppStore } from '../../store/appStore'
import { MotionPage } from '../MotionPage'
import {
  staggerContainer,
  fadeInUp,
  scaleIn,
  cardHover,
  listItem,
  modalOverlay,
  modalContent,
} from '../../lib/animations'

// ---- Types ----

type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
type TaskPriority = 'high' | 'medium' | 'low'

interface TaskComment {
  id: string
  author: string
  text: string
  timestamp: number
}

interface Task {
  id: string
  title: string
  description: string
  assignee: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string
  tags: string[]
  comments: TaskComment[]
  createdAt: number
}

interface GanttItem {
  id: string
  title: string
  assignee: string
  startPercent: number
  widthPercent: number
  color: string
}

// ---- Constants ----

const STATUS_COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-muted-foreground' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-primary' },
  { id: 'review', label: 'Review', color: 'bg-warning' },
  { id: 'done', label: 'Done', color: 'bg-success' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; variant: 'danger' | 'warning' | 'info' }> = {
  high: { label: 'High', variant: 'danger' },
  medium: { label: 'Medium', variant: 'warning' },
  low: { label: 'Low', variant: 'info' },
}

const TEAM_MEMBERS = ['Alexei Petrov', 'Maria Chen', 'David Kim', 'Sarah Johnson', 'Oleg Novak', 'Lena Vogt']

const TAG_COLORS: Record<string, string> = {
  BIM: 'bg-primary/10 text-primary',
  'MEP': 'bg-chart-3/10 text-chart-3',
  Structural: 'bg-destructive/10 text-destructive',
  Architecture: 'bg-success/10 text-success',
  QTO: 'bg-warning/10 text-warning',
  Coordination: 'bg-chart-3/10 text-chart-3',
  Documentation: 'bg-muted text-muted-foreground',
  Urgent: 'bg-destructive/10 text-destructive',
}

// ---- Mock Data ----

const INITIAL_TASKS: Task[] = [
  {
    id: '1', title: 'Review structural model clash report',
    description: 'Analyze the latest clash detection results between structural and MEP models. Identify critical clashes and propose resolutions.',
    assignee: 'Alexei Petrov', priority: 'high', status: 'todo',
    dueDate: '2026-02-15', tags: ['BIM', 'Structural', 'Coordination'],
    comments: [
      { id: 'c1', author: 'Maria Chen', text: 'I uploaded the latest clash report to the shared drive.', timestamp: Date.now() - 86400000 },
    ],
    createdAt: Date.now() - 172800000,
  },
  {
    id: '2', title: 'Update MEP routing Level 3',
    description: 'Reroute HVAC ducts on Level 3 to avoid structural beam conflicts identified in clash detection.',
    assignee: 'Maria Chen', priority: 'high', status: 'in_progress',
    dueDate: '2026-02-12', tags: ['MEP', 'BIM'],
    comments: [
      { id: 'c2', author: 'Alexei Petrov', text: 'Please check clearance with fire rating requirements.', timestamp: Date.now() - 43200000 },
      { id: 'c3', author: 'Maria Chen', text: 'Will verify against fire safety standards today.', timestamp: Date.now() - 21600000 },
    ],
    createdAt: Date.now() - 259200000,
  },
  {
    id: '3', title: 'Export QTO for tender package',
    description: 'Generate quantity takeoff reports for all disciplines and format for tender submission.',
    assignee: 'David Kim', priority: 'medium', status: 'in_progress',
    dueDate: '2026-02-18', tags: ['QTO', 'Documentation'],
    comments: [],
    createdAt: Date.now() - 345600000,
  },
  {
    id: '4', title: 'Validate facade model naming',
    description: 'Run naming convention check on the facade elements. Ensure compliance with ISO 19650.',
    assignee: 'Sarah Johnson', priority: 'medium', status: 'review',
    dueDate: '2026-02-10', tags: ['BIM', 'Architecture'],
    comments: [
      { id: 'c4', author: 'Sarah Johnson', text: 'Validation complete. 3 minor naming issues found and fixed.', timestamp: Date.now() - 7200000 },
    ],
    createdAt: Date.now() - 432000000,
  },
  {
    id: '5', title: 'Set up Telegram notifications',
    description: 'Configure the Telegram bot to send daily project status updates and deadline reminders to the team channel.',
    assignee: 'Oleg Novak', priority: 'low', status: 'todo',
    dueDate: '2026-02-20', tags: ['Coordination'],
    comments: [],
    createdAt: Date.now() - 518400000,
  },
  {
    id: '6', title: 'Complete foundation IFC model',
    description: 'Finalize the foundation model with all pile caps, grade beams, and footing details.',
    assignee: 'Alexei Petrov', priority: 'high', status: 'done',
    dueDate: '2026-02-08', tags: ['BIM', 'Structural'],
    comments: [
      { id: 'c5', author: 'Alexei Petrov', text: 'Model complete and uploaded. All properties verified.', timestamp: Date.now() - 3600000 },
    ],
    createdAt: Date.now() - 604800000,
  },
  {
    id: '7', title: 'Prepare cost estimation report',
    description: 'Generate cost estimation for Phase 2 using the latest QTO data and unit prices.',
    assignee: 'David Kim', priority: 'medium', status: 'done',
    dueDate: '2026-02-09', tags: ['QTO', 'Documentation'],
    comments: [],
    createdAt: Date.now() - 691200000,
  },
  {
    id: '8', title: 'Review architect RFI responses',
    description: 'Go through 5 pending RFI responses from the architect and update affected model elements.',
    assignee: 'Lena Vogt', priority: 'medium', status: 'review',
    dueDate: '2026-02-14', tags: ['Architecture', 'Coordination'],
    comments: [],
    createdAt: Date.now() - 777600000,
  },
  {
    id: '9', title: 'Update fire safety classification',
    description: 'Apply correct fire rating classifications to all walls and doors per updated fire safety plan.',
    assignee: 'Sarah Johnson', priority: 'high', status: 'todo',
    dueDate: '2026-02-11', tags: ['BIM', 'Architecture', 'Urgent'],
    comments: [],
    createdAt: Date.now() - 86400000,
  },
  {
    id: '10', title: 'Coordinate site logistics model',
    description: 'Create 4D sequence for crane placement and material laydown areas.',
    assignee: 'Oleg Novak', priority: 'low', status: 'in_progress',
    dueDate: '2026-02-25', tags: ['Coordination'],
    comments: [],
    createdAt: Date.now() - 1209600000,
  },
]

const GANTT_ITEMS: GanttItem[] = [
  { id: '1', title: 'Foundation IFC Model', assignee: 'Alexei P.', startPercent: 0, widthPercent: 25, color: '#3b82f6' },
  { id: '2', title: 'MEP Routing L3', assignee: 'Maria C.', startPercent: 10, widthPercent: 30, color: '#8b5cf6' },
  { id: '3', title: 'QTO Tender Package', assignee: 'David K.', startPercent: 20, widthPercent: 35, color: '#f59e0b' },
  { id: '4', title: 'Facade Naming Validation', assignee: 'Sarah J.', startPercent: 15, widthPercent: 20, color: '#10b981' },
  { id: '5', title: 'Telegram Bot Setup', assignee: 'Oleg N.', startPercent: 40, widthPercent: 25, color: '#06b6d4' },
  { id: '6', title: 'Fire Safety Classification', assignee: 'Sarah J.', startPercent: 30, widthPercent: 30, color: '#ef4444' },
  { id: '7', title: 'Site Logistics Model', assignee: 'Oleg N.', startPercent: 50, widthPercent: 40, color: '#ec4899' },
]

// ---- Component ----

export default function ProjectMgmtPage() {
  const { addNotification } = useAppStore()
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  useEffect(() => {
    fetchTasks()
      .then((rows) => { if (rows.length > 0) setTasks(rows as Task[]) })
      .catch(() => {})
  }, [])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [commentText, setCommentText] = useState('')
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<TaskPriority | ''>('')
  const [showFilters, setShowFilters] = useState(false)

  // New task form state
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newAssignee, setNewAssignee] = useState(TEAM_MEMBERS[0])
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium')
  const [newDueDate, setNewDueDate] = useState('')
  const [newTags, setNewTags] = useState<string[]>([])

  // Stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && new Date(t.dueDate) < new Date()).length
  const teamMembers = new Set(tasks.map((t) => t.assignee)).size

  // Filtering
  const filteredTasks = tasks.filter((t) => {
    if (filterAssignee && t.assignee !== filterAssignee) return false
    if (filterPriority && t.priority !== filterPriority) return false
    return true
  })

  const getColumnTasks = (status: TaskStatus) =>
    filteredTasks.filter((t) => t.status === status)

  // Telegram integration status
  const telegramConnected = true

  const addTask = useCallback(() => {
    if (!newTitle.trim()) {
      addNotification('warning', 'Please enter a task title.')
      return
    }
    const task: Task = {
      id: String(Date.now()),
      title: newTitle,
      description: newDescription,
      assignee: newAssignee,
      priority: newPriority,
      status: 'todo',
      dueDate: newDueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      tags: newTags,
      comments: [],
      createdAt: Date.now(),
    }
    setTasks((prev) => [task, ...prev])
    // Persist to Supabase
    sbCreateTask({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.dueDate,
      tags: task.tags,
    }).catch(() => {})
    setShowAddDialog(false)
    setNewTitle('')
    setNewDescription('')
    setNewAssignee(TEAM_MEMBERS[0])
    setNewPriority('medium')
    setNewDueDate('')
    setNewTags([])
    addNotification('success', `Task "${task.title}" created.`)
  }, [newTitle, newDescription, newAssignee, newPriority, newDueDate, newTags, addNotification])

  const addComment = useCallback(() => {
    if (!commentText.trim() || !selectedTask) return
    const comment: TaskComment = {
      id: String(Date.now()),
      author: 'You',
      text: commentText,
      timestamp: Date.now(),
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === selectedTask.id ? { ...t, comments: [...t.comments, comment] } : t,
      ),
    )
    setSelectedTask((prev) => prev ? { ...prev, comments: [...prev.comments, comment] } : null)
    setCommentText('')
    sbAddComment(selectedTask.id, 'You', commentText).catch(() => {})
  }, [commentText, selectedTask])

  const moveTask = useCallback((taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    )
    sbUpdateTask(taskId, { status: newStatus }).catch(() => {})
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => prev ? { ...prev, status: newStatus } : null)
    }
  }, [selectedTask])

  const toggleTag = (tag: string) => {
    setNewTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  const isOverdue = (task: Task) => task.status !== 'done' && new Date(task.dueDate) < new Date()

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <LayoutDashboard size={28} className="text-primary" />
              Project Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Track tasks, coordinate team, and manage project timeline
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Telegram status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
              <BotMessageSquare size={16} className={telegramConnected ? 'text-success' : 'text-muted-foreground'} />
              <span className="text-xs font-medium text-muted-foreground">
                Telegram Bot: {telegramConnected ? 'Connected' : 'Disconnected'}
              </span>
              <div className={`w-2 h-2 rounded-full ${telegramConnected ? 'bg-success' : 'bg-muted-foreground'}`} />
            </div>
            <Button
              variant="outline"
              icon={<Filter size={16} />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setShowAddDialog(true)}>
              Add Task
            </Button>
          </div>
        </div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeInUp}>
            <StatCard label="Total Tasks" value={totalTasks} icon={ListTodo} color="primary" />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <StatCard label="Completed" value={completedTasks} icon={CheckCircle2} color="success" trend={{ value: Math.round((completedTasks / totalTasks) * 100), label: 'completion rate' }} />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <StatCard label="Overdue" value={overdueTasks} icon={AlertCircle} color={overdueTasks > 0 ? 'danger' : 'success'} />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <StatCard label="Team Members" value={teamMembers} icon={Users} color="primary" />
          </motion.div>
        </motion.div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground">Assignee:</label>
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All</option>
                  {TEAM_MEMBERS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground">Priority:</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as TaskPriority | '')}
                  className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              {(filterAssignee || filterPriority) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFilterAssignee(''); setFilterPriority('') }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const columnTasks = getColumnTasks(col.id)
            return (
              <div key={col.id} className="space-y-3">
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                    <h3 className="font-semibold text-foreground text-sm">{col.label}</h3>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={columnTasks.length}
                        className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        {columnTasks.length}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Task Cards */}
                <motion.div
                  className="space-y-3 min-h-[200px]"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {columnTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      variants={cardHover}
                      initial="rest"
                      animate="rest"
                      whileHover="hover"
                      onClick={() => setSelectedTask(task)}
                      className="bg-card rounded-xl border border-border shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all group"
                    >
                      {/* Drag handle */}
                      <div className="flex items-start gap-2">
                        <GripVertical size={14} className="text-muted-foreground/40 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex-1 min-w-0">
                          {/* Priority + Title */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium text-foreground leading-snug">{task.title}</h4>
                            <Badge variant={PRIORITY_CONFIG[task.priority].variant} className="shrink-0">
                              {PRIORITY_CONFIG[task.priority].label}
                            </Badge>
                          </div>

                          {/* Tags */}
                          {task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {task.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${TAG_COLORS[tag] || 'bg-muted text-muted-foreground'}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <User size={12} />
                              <span>{task.assignee.split(' ')[0]}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {task.comments.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <MessageSquare size={12} />
                                  <span>{task.comments.length}</span>
                                </div>
                              )}
                              <div className={`flex items-center gap-1 ${isOverdue(task) ? 'text-destructive font-medium' : ''}`}>
                                <Calendar size={12} />
                                <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="flex items-center justify-center h-32 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
                      No tasks
                    </div>
                  )}
                </motion.div>
              </div>
            )
          })}
        </div>

        {/* Timeline / Gantt */}
        <Card title="Project Timeline" subtitle="Simplified Gantt view of active tasks">
          <div className="space-y-2">
            {/* Time axis */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-3">
              <span>Feb 1</span>
              <span>Feb 8</span>
              <span>Feb 15</span>
              <span>Feb 22</span>
              <span>Mar 1</span>
            </div>

            {GANTT_ITEMS.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-right">
                  <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.assignee}</p>
                </div>
                <div className="flex-1 h-7 bg-muted rounded-md relative border border-border overflow-hidden">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex">
                    {[0, 25, 50, 75].map((pos) => (
                      <div key={pos} className="h-full border-r border-border/30" style={{ width: '25%' }} />
                    ))}
                  </div>
                  {/* Bar */}
                  <motion.div
                    className="absolute top-1 bottom-1 rounded-md"
                    style={{
                      left: `${item.startPercent}%`,
                      backgroundColor: item.color,
                      opacity: 0.85,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.widthPercent}%` }}
                    transition={{ duration: 0.8, delay: index * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white truncate px-2">
                      {item.widthPercent > 15 ? item.title : ''}
                    </span>
                  </motion.div>
                  {/* Today marker */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10" style={{ left: '27%' }}>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] text-destructive font-bold whitespace-nowrap">
                      Today
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Add Task Dialog */}
        <AnimatePresence>
          {showAddDialog && (
            <motion.div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowAddDialog(false)}
              variants={modalOverlay}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div
                className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg"
                onClick={(e) => e.stopPropagation()}
                variants={modalContent}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">New Task</h3>
                  <button onClick={() => setShowAddDialog(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                    <X size={18} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Title *</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Enter task title..."
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Describe the task..."
                      rows={3}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>

                  {/* Assignee + Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Assignee</label>
                      <select
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {TEAM_MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(TAG_COLORS).map((tag) => (
                        <motion.button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            newTags.includes(tag)
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border text-muted-foreground hover:border-primary/20'
                          }`}
                        >
                          <Tag size={10} className="inline mr-1" />
                          {tag}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                  <Button onClick={addTask} icon={<Plus size={16} />}>Create Task</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task Detail Drawer */}
        <AnimatePresence>
          {selectedTask && (
            <motion.div
              className="fixed inset-0 bg-black/50 flex justify-end z-50"
              onClick={() => setSelectedTask(null)}
              variants={modalOverlay}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div
                className="bg-card w-full max-w-lg h-full overflow-y-auto shadow-2xl border-l border-border"
                onClick={(e) => e.stopPropagation()}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
                  <div className="flex items-center gap-3">
                    <Badge variant={PRIORITY_CONFIG[selectedTask.priority].variant}>
                      {PRIORITY_CONFIG[selectedTask.priority].label}
                    </Badge>
                    <Badge variant={selectedTask.status === 'done' ? 'success' : 'default'}>
                      {STATUS_COLUMNS.find((c) => c.id === selectedTask.status)?.label}
                    </Badge>
                  </div>
                  <button onClick={() => setSelectedTask(null)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                    <X size={18} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Title & Description */}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selectedTask.title}</h2>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{selectedTask.description}</p>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">Assignee</p>
                      <div className="flex items-center gap-2 mt-1">
                        <User size={14} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">{selectedTask.assignee}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <div className={`flex items-center gap-2 mt-1 ${isOverdue(selectedTask) ? 'text-destructive' : ''}`}>
                        <Calendar size={14} className={isOverdue(selectedTask) ? 'text-destructive' : 'text-primary'} />
                        <span className="text-sm font-medium">{new Date(selectedTask.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">Created</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={14} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">{new Date(selectedTask.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">Comments</p>
                      <div className="flex items-center gap-2 mt-1">
                        <MessageSquare size={14} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">{selectedTask.comments.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedTask.tags.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTask.tags.map((tag) => (
                          <span key={tag} className={`text-xs px-2 py-1 rounded-md font-medium ${TAG_COLORS[tag] || 'bg-muted text-muted-foreground'}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Move Task */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Move To</p>
                    <div className="flex gap-2">
                      {STATUS_COLUMNS.filter((c) => c.id !== selectedTask.status).map((col) => (
                        <Button
                          key={col.id}
                          variant="outline"
                          size="sm"
                          onClick={() => moveTask(selectedTask.id, col.id)}
                          icon={<ArrowRight size={12} />}
                        >
                          {col.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Comments ({selectedTask.comments.length})
                    </p>

                    {selectedTask.comments.length > 0 ? (
                      <motion.div
                        className="space-y-3"
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                      >
                        {selectedTask.comments.map((comment) => (
                          <motion.div
                            key={comment.id}
                            variants={listItem}
                            className="p-3 bg-muted rounded-lg border border-border"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-foreground">{comment.author}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(comment.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{comment.text}</p>
                          </motion.div>
                        ))}
                      </motion.div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                    )}

                    {/* Add comment */}
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addComment() }}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <Button
                        size="sm"
                        icon={<SendIcon size={14} />}
                        onClick={addComment}
                        disabled={!commentText.trim()}
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionPage>
  )
}
