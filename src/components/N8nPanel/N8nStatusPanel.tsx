import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Workflow, Activity, Play, RefreshCw, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Clock, Zap,
  Server,
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Tabs } from '../ui/Tabs'
import { MotionPage } from '../MotionPage'
import { staggerContainer, fadeInUp, listItem } from '../../lib/animations'
import {
  getN8nHealth,
  getN8nWorkflows,
  getN8nExecutions,
  getN8nWorkflowTriggers,
  triggerN8nWorkflow,
  type N8nWorkflow,
  type N8nExecution,
  type N8nWorkflowTriggerMap,
} from '../../services/api'

export default function N8nStatusPanel() {
  const [online, setOnline] = useState(false)
  const [n8nUrl, setN8nUrl] = useState('')
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([])
  const [executions, setExecutions] = useState<N8nExecution[]>([])
  const [workflowTriggers, setWorkflowTriggers] = useState<N8nWorkflowTriggerMap[]>([])
  const [loading, setLoading] = useState(true)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [health, wfs, execs, triggers] = await Promise.allSettled([
        getN8nHealth(),
        getN8nWorkflows(),
        getN8nExecutions(),
        getN8nWorkflowTriggers(),
      ])

      if (health.status === 'fulfilled') {
        setOnline(health.value.online)
        setN8nUrl(health.value.url)
      } else {
        setOnline(false)
      }

      if (wfs.status === 'fulfilled') setWorkflows(wfs.value)
      if (execs.status === 'fulfilled') setExecutions(execs.value)
      if (triggers.status === 'fulfilled') setWorkflowTriggers(triggers.value)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleTrigger = async (webhookPath: string) => {
    setTriggeringId(webhookPath)
    try {
      await triggerN8nWorkflow(webhookPath, {
        source: 'jens-platform',
        timestamp: new Date().toISOString(),
      })
      // Refresh executions after trigger
      setTimeout(refresh, 2000)
    } catch {
      // error handled by UI
    } finally {
      setTriggeringId(null)
    }
  }

  const activeCount = workflows.filter((w) => w.active).length
  const errorCount = executions.filter((e) => e.status === 'error').length

  const tabs = [
    { id: 'workflows', label: 'Workflows', icon: <Workflow size={16} /> },
    { id: 'executions', label: 'Executions', icon: <Activity size={16} /> },
  ]

  function getWorkflowWebhookPath(workflowId: string): string | null {
    const wfTriggerMap = workflowTriggers.find((item) => item.workflowId === workflowId)
    if (!wfTriggerMap) return null

    const trigger = wfTriggerMap.triggers.find((item) =>
      item.triggerType === 'webhook'
      && item.method === 'POST'
      && !item.disabled
      && !!item.endpointPath,
    )

    return trigger?.endpointPath || null
  }

  return (
    <MotionPage className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">n8n Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and monitor n8n workflow automation
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={refresh}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          label="n8n Status"
          value={online ? 'Online' : 'Offline'}
          icon={Server}
          color={online ? 'success' : 'danger'}
        />
        <StatCard
          label="Total Workflows"
          value={workflows.length}
          icon={Workflow}
          color="primary"
        />
        <StatCard
          label="Active Workflows"
          value={activeCount}
          icon={Zap}
          color="success"
        />
        <StatCard
          label="Recent Errors"
          value={errorCount}
          icon={AlertTriangle}
          color={errorCount > 0 ? 'warning' : 'success'}
        />
      </motion.div>

      {/* Connection Info */}
      {!online && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-3">
              <XCircle size={20} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">n8n is not reachable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Make sure n8n is running at <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{n8nUrl || 'http://localhost:5678'}</code>.
                  Start it with <code className="text-xs bg-muted px-1.5 py-0.5 rounded">n8n start</code> or Docker.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Tabs: Workflows + Executions */}
      <Card>
        <Tabs tabs={tabs} defaultTab="workflows">
          {(activeTab) => (
            <>
              {activeTab === 'workflows' && (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {workflows.length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No workflows found. {!online && 'n8n is offline.'}
                    </p>
                  )}
                  {workflows.map((wf) => {
                    const webhookPath = getWorkflowWebhookPath(wf.id)
                    return (
                      <motion.div
                        key={wf.id}
                        variants={listItem}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${wf.active ? 'bg-success' : 'bg-muted-foreground/30'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{wf.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {wf.id}
                              {wf.updatedAt && ` · Updated: ${new Date(wf.updatedAt).toLocaleDateString()}`}
                              {webhookPath && ` · Trigger: ${webhookPath}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={wf.active ? 'success' : 'default'}>
                            {wf.active ? 'Active' : 'Inactive'}
                          </Badge>
                          {webhookPath && online && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={triggeringId === webhookPath
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Play size={14} />}
                              onClick={() => handleTrigger(webhookPath)}
                              disabled={!!triggeringId}
                            >
                              Trigger
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}

              {activeTab === 'executions' && (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {executions.length === 0 && !loading && (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No recent executions found. {!online && 'n8n is offline.'}
                    </p>
                  )}
                  {executions.map((ex) => (
                    <motion.div
                      key={ex.id}
                      variants={listItem}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {ex.status === 'success' ? (
                          <CheckCircle2 size={16} className="text-success shrink-0" />
                        ) : ex.status === 'error' ? (
                          <XCircle size={16} className="text-destructive shrink-0" />
                        ) : (
                          <Clock size={16} className="text-warning shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {ex.workflowName || `Workflow ${ex.workflowId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ex.startedAt ? new Date(ex.startedAt).toLocaleString() : 'Unknown'}
                            {ex.mode && ` · ${ex.mode}`}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          ex.status === 'success' ? 'success'
                            : ex.status === 'error' ? 'danger'
                              : 'warning'
                        }
                      >
                        {ex.status}
                      </Badge>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}
        </Tabs>
      </Card>

      {/* Known Issues / Info */}
      <Card title="Integration Notes" subtitle="Known issues and requirements">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Qdrant not deployed</strong> — CWICR semantic search is disabled. Deploy Qdrant via Docker to enable.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Cloudflare tunnel URL is temporary</strong> — Webhook URLs will change when tunnel restarts.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <XCircle size={14} className="text-destructive shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">CAD workflows (n8n_1-9)</strong> — Require local RvtExporter.exe with Revit installed.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Photo Cost Estimate Pro v2.0</strong> — Form trigger, should work when n8n is online.
            </span>
          </div>
        </div>
      </Card>
    </MotionPage>
  )
}
