import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, MapPin, Clock, User } from 'lucide-react'
import { fetchFieldReports } from '../../services/supabase-api'
import { listItem, staggerContainer } from '../../lib/animations'

interface FieldReport {
  id: string
  taskId: string | null
  reporter: string
  description: string | null
  photoUrls: string[]
  gpsLat: number | null
  gpsLon: number | null
  address: string | null
  reportType: string
  createdAt: string
}

interface FieldReportsPanelProps {
  taskId?: string
}

export default function FieldReportsPanel({ taskId }: FieldReportsPanelProps) {
  const [reports, setReports] = useState<FieldReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchFieldReports(taskId)
      .then((data) => setReports(data as FieldReport[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) {
    return (
      <div className="text-center py-6">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground mt-2">Загрузка отчётов...</p>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-6">
        <Camera size={32} className="mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">Фотоотчётов пока нет</p>
      </div>
    )
  }

  return (
    <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
      {reports.map((report) => (
        <motion.div
          key={report.id}
          variants={listItem}
          className="p-3 bg-muted rounded-lg border border-border"
        >
          {/* Photos grid */}
          {report.photoUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {report.photoUrls.slice(0, 4).map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Report photo ${idx + 1}`}
                  className="w-full h-24 object-cover rounded-md border border-border"
                />
              ))}
            </div>
          )}

          {report.description && (
            <p className="text-sm text-foreground mb-2">{report.description}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User size={12} /> {report.reporter}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {new Date(report.createdAt).toLocaleString()}
            </span>
            {(report.gpsLat != null && report.gpsLon != null) && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {report.address || `${report.gpsLat.toFixed(4)}, ${report.gpsLon.toFixed(4)}`}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
