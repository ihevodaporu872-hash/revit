import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Upload, Ruler, Box, Layers, Tag, Wrench, FileSpreadsheet, Hash } from 'lucide-react'
import type { RevitProperties } from './ifc/types'

interface Props {
  revitProps: RevitProperties | undefined
  ifcProperties: { name: string; value: string }[]
  onUploadXlsx?: () => void
}

interface GroupProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: string
}

function PropertyGroup({ title, icon, defaultOpen = false, children, badge }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {badge && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
            {badge}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PropRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex justify-between items-start py-1.5 text-xs">
      <span className="text-muted-foreground shrink-0 mr-3">{label}</span>
      <span className="text-foreground font-medium text-right break-all">{String(value)}</span>
    </div>
  )
}

function DimensionCard({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  if (value === undefined || value === null || value === 0) return null
  const formatted = value >= 1000
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value.toFixed(3)

  return (
    <div className="bg-muted/40 rounded-lg p-2.5 border border-border/50">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-base font-bold text-foreground leading-tight">{formatted}</p>
      <p className="text-[10px] text-muted-foreground">{unit}</p>
    </div>
  )
}

export function RevitPropertiesPanel({ revitProps, ifcProperties, onUploadXlsx }: Props) {
  if (!revitProps) {
    return (
      <div className="px-4 py-3">
        {/* IFC Properties fallback */}
        <PropertyGroup title="IFC Properties" icon={<Hash size={11} />} defaultOpen>
          <div className="space-y-0">
            {ifcProperties.map((prop, i) => (
              <div
                key={i}
                className={`flex justify-between items-start py-2 px-2 rounded text-xs ${
                  i % 2 === 0 ? 'bg-muted/30' : ''
                }`}
              >
                <span className="text-muted-foreground shrink-0 mr-3">{prop.name}</span>
                <span className="text-foreground font-medium text-right break-all">{prop.value}</span>
              </div>
            ))}
          </div>
        </PropertyGroup>

        {/* Banner to upload */}
        <button
          onClick={onUploadXlsx}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium bg-primary/5 text-primary border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
        >
          <Upload size={14} />
          Upload Revit XLSX for enriched properties
        </button>
      </div>
    )
  }

  const hasDimensions = revitProps.area || revitProps.volume || revitProps.length || revitProps.width || revitProps.height || revitProps.perimeter
  const hasMaterials = revitProps.material || revitProps.materialArea || revitProps.materialVolume
  const hasLocation = revitProps.level || revitProps.phaseCreated || revitProps.phaseDemolished
  const hasClassification = revitProps.classification || revitProps.assemblyCode || revitProps.structuralUsage
  const customEntries = revitProps.customParams ? Object.entries(revitProps.customParams).filter(([, v]) => v !== null && v !== undefined && v !== '') : []

  return (
    <div>
      {/* Identity */}
      <PropertyGroup title="Identity" icon={<Tag size={11} />} defaultOpen badge="Revit">
        <PropRow label="Name" value={revitProps.elementName} />
        <PropRow label="Type" value={revitProps.elementType} />
        <PropRow label="Category" value={revitProps.category} />
        <PropRow label="Family" value={revitProps.family} />
        <PropRow label="Family Type" value={revitProps.familyType} />
        <PropRow label="Mark" value={revitProps.mark} />
        <PropRow label="GlobalId" value={revitProps.globalId} />
        <PropRow label="Comments" value={revitProps.comments} />
      </PropertyGroup>

      {/* Dimensions */}
      {hasDimensions && (
        <PropertyGroup title="Dimensions" icon={<Ruler size={11} />} defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <DimensionCard label="Area" value={revitProps.area} unit="m²" />
            <DimensionCard label="Volume" value={revitProps.volume} unit="m³" />
            <DimensionCard label="Length" value={revitProps.length} unit="m" />
            <DimensionCard label="Width" value={revitProps.width} unit="m" />
            <DimensionCard label="Height" value={revitProps.height} unit="m" />
            <DimensionCard label="Perimeter" value={revitProps.perimeter} unit="m" />
          </div>
        </PropertyGroup>
      )}

      {/* Materials */}
      {hasMaterials && (
        <PropertyGroup title="Materials" icon={<Box size={11} />}>
          <PropRow label="Material" value={revitProps.material} />
          {revitProps.materialArea !== undefined && revitProps.materialArea !== 0 && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <DimensionCard label="Material Area" value={revitProps.materialArea} unit="m²" />
              <DimensionCard label="Material Volume" value={revitProps.materialVolume} unit="m³" />
            </div>
          )}
        </PropertyGroup>
      )}

      {/* Location */}
      {hasLocation && (
        <PropertyGroup title="Location" icon={<Layers size={11} />}>
          <PropRow label="Level" value={revitProps.level} />
          <PropRow label="Phase Created" value={revitProps.phaseCreated} />
          <PropRow label="Phase Demolished" value={revitProps.phaseDemolished} />
        </PropertyGroup>
      )}

      {/* Classification */}
      {hasClassification && (
        <PropertyGroup title="Classification" icon={<Wrench size={11} />}>
          <PropRow label="Classification" value={revitProps.classification} />
          <PropRow label="Assembly Code" value={revitProps.assemblyCode} />
          <PropRow label="Structural Usage" value={revitProps.structuralUsage} />
        </PropertyGroup>
      )}

      {/* IFC Properties (original from web-ifc) */}
      {ifcProperties.length > 0 && (
        <PropertyGroup title="IFC Properties" icon={<Hash size={11} />}>
          <div className="space-y-0">
            {ifcProperties.map((prop, i) => (
              <div
                key={i}
                className={`flex justify-between items-start py-1.5 px-2 rounded text-xs ${
                  i % 2 === 0 ? 'bg-muted/30' : ''
                }`}
              >
                <span className="text-muted-foreground shrink-0 mr-3">{prop.name}</span>
                <span className="text-foreground font-medium text-right break-all">{prop.value}</span>
              </div>
            ))}
          </div>
        </PropertyGroup>
      )}

      {/* Custom Parameters */}
      {customEntries.length > 0 && (
        <PropertyGroup title="Custom Parameters" icon={<FileSpreadsheet size={11} />} badge={String(customEntries.length)}>
          {customEntries.map(([key, val], i) => (
            <div
              key={key}
              className={`flex justify-between items-start py-1.5 px-2 rounded text-xs ${
                i % 2 === 0 ? 'bg-muted/30' : ''
              }`}
            >
              <span className="text-muted-foreground shrink-0 mr-3">{key}</span>
              <span className="text-foreground font-medium text-right break-all">{String(val)}</span>
            </div>
          ))}
        </PropertyGroup>
      )}
    </div>
  )
}
