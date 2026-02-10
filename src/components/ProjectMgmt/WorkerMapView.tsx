import { useState, useEffect } from 'react'
import { MapPin, RefreshCw, Users } from 'lucide-react'
import { fetchWorkerLocations, fetchFieldReports } from '../../services/supabase-api'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface WorkerLocation {
  id: string
  workerName: string
  lat: number
  lon: number
  accuracy: number | null
  recordedAt: string
}

interface FieldReportMarker {
  id: string
  reporter: string
  gpsLat: number
  gpsLon: number
  description: string | null
  createdAt: string
}

export default function WorkerMapView() {
  const [workers, setWorkers] = useState<WorkerLocation[]>([])
  const [reports, setReports] = useState<FieldReportMarker[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [workerData, reportData] = await Promise.all([
        fetchWorkerLocations(),
        fetchFieldReports(undefined, 100),
      ])
      setWorkers(workerData as WorkerLocation[])
      setReports(
        (reportData as Array<Record<string, unknown>>)
          .filter((r) => r.gpsLat != null && r.gpsLon != null)
          .map((r) => ({
            id: r.id as string,
            reporter: r.reporter as string,
            gpsLat: r.gpsLat as number,
            gpsLon: r.gpsLon as number,
            description: r.description as string | null,
            createdAt: r.createdAt as string,
          }))
      )
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Since react-leaflet requires external CSS and may not be installed,
  // we render a static map view with markers listed
  const allMarkers = [
    ...workers.map((w) => ({
      id: w.id,
      type: 'worker' as const,
      name: w.workerName,
      lat: w.lat,
      lon: w.lon,
      time: w.recordedAt,
    })),
    ...reports.map((r) => ({
      id: r.id,
      type: 'report' as const,
      name: r.reporter,
      lat: r.gpsLat,
      lon: r.gpsLon,
      time: r.createdAt,
    })),
  ]

  // Calculate center for the map iframe
  const centerLat = allMarkers.length > 0 ? allMarkers.reduce((s, m) => s + m.lat, 0) / allMarkers.length : 55.75
  const centerLon = allMarkers.length > 0 ? allMarkers.reduce((s, m) => s + m.lon, 0) / allMarkers.length : 37.62

  return (
    <Card
      title="Карта работников и отчётов"
      subtitle={`${workers.length} работников, ${reports.length} фотоотчётов с GPS`}
      hover
      actions={
        <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={loadData} loading={loading}>
          Обновить
        </Button>
      }
    >
      {/* OpenStreetMap embed */}
      <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: 400 }}>
        <iframe
          title="Worker Map"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${centerLon - 0.05},${centerLat - 0.03},${centerLon + 0.05},${centerLat + 0.03}&layer=mapnik&marker=${centerLat},${centerLon}`}
          allowFullScreen
        />
      </div>

      {/* Markers list */}
      {allMarkers.length > 0 ? (
        <div className="mt-4 space-y-2">
          {allMarkers.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-2 bg-muted rounded-lg border border-border text-sm">
              {m.type === 'worker' ? (
                <Users size={14} className="text-blue-500 shrink-0" />
              ) : (
                <MapPin size={14} className="text-orange-500 shrink-0" />
              )}
              <span className="font-medium text-foreground">{m.name}</span>
              <span className="text-muted-foreground text-xs">
                {m.lat.toFixed(4)}, {m.lon.toFixed(4)}
              </span>
              <span className="text-muted-foreground text-xs ml-auto">
                {new Date(m.time).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 mt-4">
          <MapPin size={40} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Данных о местоположении пока нет</p>
        </div>
      )}
    </Card>
  )
}
