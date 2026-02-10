import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Upload, Ruler, Box, Layers, Tag, Wrench, FileSpreadsheet, Hash, Component, Move3D, Square, ArrowUpDown, StickyNote } from 'lucide-react'
import type { RevitProperties } from './ifc/types'

interface Props {
  revitProps: RevitProperties | undefined
  ifcProperties: { name: string; value: string }[]
  onUploadXlsx?: () => void
  matchSource?: 'elementId' | 'globalId' | 'typeIfcGuid' | 'mixed'
  tag?: string
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

function HeroPropertyCard({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string | number | undefined; unit?: string }) {
  const display = value !== undefined && value !== null && value !== ''
    ? typeof value === 'number'
      ? value >= 1000
        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : value.toFixed(3)
      : String(value)
    : null

  return (
    <div className="bg-muted/40 rounded-xl p-3 border border-border/50">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      {display ? (
        <div>
          <span className="text-lg font-bold text-foreground leading-tight">{display}</span>
          {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
        </div>
      ) : (
        <span className="text-lg font-bold text-muted-foreground/40 leading-tight">&mdash;</span>
      )}
    </div>
  )
}

function HeroPropertiesSection({ revitProps, ifcProperties, matchConfidence }: {
  revitProps: RevitProperties | undefined
  ifcProperties: { name: string; value: string }[]
  matchConfidence?: number
}) {
  // Extract values from revitProps or fall back to IFC-extracted values
  let heroType = revitProps?.elementType || revitProps?.category
  let heroVolume = revitProps?.volume
  let heroArea = revitProps?.area
  let heroLength = revitProps?.length
  let heroHeight = revitProps?.height
  const heroNotes = revitProps?.comments

  // Fallback: try to extract from IFC properties
  if (!heroType) {
    const typeProps = ifcProperties.find((p) => /type|objecttype/i.test(p.name))
    if (typeProps) heroType = typeProps.value
  }
  if (heroVolume === undefined) {
    const volProp = ifcProperties.find((p) => /volume|netvolume|grossvolume/i.test(p.name))
    if (volProp) heroVolume = parseFloat(volProp.value) || undefined
  }
  if (heroArea === undefined) {
    const areaProp = ifcProperties.find((p) => /area|netsidearea|grosssidearea|netfloorarea/i.test(p.name))
    if (areaProp) heroArea = parseFloat(areaProp.value) || undefined
  }
  if (heroLength === undefined) {
    const lenProp = ifcProperties.find((p) => /\blength\b/i.test(p.name))
    if (lenProp) heroLength = parseFloat(lenProp.value) || undefined
  }
  if (heroHeight === undefined) {
    const htProp = ifcProperties.find((p) => /\bheight\b/i.test(p.name))
    if (htProp) heroHeight = parseFloat(htProp.value) || undefined
  }

  const hasAny = heroType || heroVolume !== undefined || heroArea !== undefined || heroLength !== undefined || heroHeight !== undefined || heroNotes

  if (!hasAny) return null

  const confDot = matchConfidence !== undefined
    ? matchConfidence >= 0.85 ? 'bg-emerald-500'
      : matchConfidence >= 0.65 ? 'bg-amber-500'
        : 'bg-red-500'
    : null

  return (
    <div className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-3 border-b border-border/50">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key Properties</span>
        {confDot && <span className={`w-2 h-2 rounded-full ${confDot}`} />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <HeroPropertyCard icon={<Component size={12} />} label="Type" value={heroType} />
        <HeroPropertyCard icon={<Box size={12} />} label="Volume" value={heroVolume} unit="m\u00B3" />
        <HeroPropertyCard icon={<Square size={12} />} label="Area" value={heroArea} unit="m\u00B2" />
        <HeroPropertyCard icon={<Move3D size={12} />} label="Length" value={heroLength} unit="m" />
        <HeroPropertyCard icon={<ArrowUpDown size={12} />} label="Height" value={heroHeight} unit="m" />
        <HeroPropertyCard icon={<StickyNote size={12} />} label="Notes" value={heroNotes} />
      </div>
    </div>
  )
}

interface IfcPropertyItem {
  section: string
  key: string
  value: string
  rawName: string
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function parseIfcPropertyName(rawName: string): { section: string; key: string } {
  const name = String(rawName || '').trim()
  if (!name) return { section: 'General', key: 'Value' }

  const slash = name.includes('/') ? name.split('/') : null
  if (slash && slash.length >= 2) {
    return {
      section: toTitleCase(slash[0]),
      key: toTitleCase(slash.slice(1).join('/')),
    }
  }

  const dot = name.includes('.') ? name.split('.') : null
  if (dot && dot.length >= 2 && /^pset|^qto/i.test(dot[0])) {
    return {
      section: toTitleCase(dot[0]),
      key: toTitleCase(dot.slice(1).join('.')),
    }
  }

  if (/^pset_|^qto_/i.test(name)) {
    const normalized = name.replace(/^pset_/i, 'Pset ').replace(/^qto_/i, 'Qto ')
    return { section: 'Property Set', key: toTitleCase(normalized) }
  }

  return { section: 'General', key: toTitleCase(name) }
}

function formatIfcValue(raw: string): string {
  const value = String(raw ?? '').trim()
  if (!value) return '—'

  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === 'true' ? 'Yes' : 'No'
  }

  if (/^-?\d+([.,]\d+)?$/.test(value)) {
    const n = Number.parseFloat(value.replace(',', '.'))
    if (Number.isFinite(n)) {
      if (Number.isInteger(n)) return n.toLocaleString()
      return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    }
  }

  return value
}

function buildIfcPropertyGroups(ifcProperties: { name: string; value: string }[]): Map<string, IfcPropertyItem[]> {
  const groups = new Map<string, IfcPropertyItem[]>()

  for (const prop of ifcProperties) {
    const parsed = parseIfcPropertyName(prop.name)
    const item: IfcPropertyItem = {
      section: parsed.section,
      key: parsed.key,
      value: formatIfcValue(prop.value),
      rawName: prop.name,
    }
    const bucket = groups.get(item.section) || []
    bucket.push(item)
    groups.set(item.section, bucket)
  }

  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

function IfcPropertiesView({ ifcProperties }: { ifcProperties: { name: string; value: string }[] }) {
  if (!ifcProperties.length) return null
  const grouped = buildIfcPropertyGroups(ifcProperties)

  return (
    <div className="space-y-2.5">
      {Array.from(grouped.entries()).map(([section, items]) => (
        <div key={section} className="rounded-lg border border-border/60 overflow-hidden">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/5 border-b border-border/60">
            {section}
          </div>
          <div className="divide-y divide-border/40">
            {items.map((item, i) => (
              <div key={`${section}-${item.rawName}-${i}`} className="px-2.5 py-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide break-words" title={item.rawName}>
                  {item.key}
                </div>
                <div className="text-xs text-foreground font-medium break-all leading-snug mt-0.5">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RevitPropertiesPanel({ revitProps, ifcProperties, onUploadXlsx, matchSource, tag }: Props) {
  if (!revitProps) {
    return (
      <div>
        {/* Hero section from IFC-extracted values */}
        <HeroPropertiesSection revitProps={undefined} ifcProperties={ifcProperties} />

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-500 rounded">
              Source: IFC only
            </span>
          </div>
          {/* IFC Properties fallback */}
          <PropertyGroup title="IFC Properties" icon={<Hash size={11} />} defaultOpen>
            <IfcPropertiesView ifcProperties={ifcProperties} />
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
      </div>
    )
  }

  const hasDimensions = revitProps.area || revitProps.volume || revitProps.length || revitProps.width || revitProps.height || revitProps.perimeter
  const hasMaterials = revitProps.material || revitProps.materialArea || revitProps.materialVolume
  const hasLocation = revitProps.level || revitProps.phaseCreated || revitProps.phaseDemolished
  const hasClassification = revitProps.classification || revitProps.assemblyCode || revitProps.structuralUsage
  const customEntries = revitProps.customParams ? Object.entries(revitProps.customParams).filter(([, v]) => v !== null && v !== undefined && v !== '') : []
  const confidence = typeof revitProps.matchConfidence === 'number'
    ? `${(revitProps.matchConfidence * 100).toFixed(1)}%`
    : null

  return (
    <div>
      {/* Hero Key Properties */}
      <HeroPropertiesSection
        revitProps={revitProps}
        ifcProperties={ifcProperties}
        matchConfidence={revitProps.matchConfidence}
      />

      {/* Identity */}
      <PropertyGroup title="Identity" icon={<Tag size={11} />} defaultOpen badge="Revit">
        {matchSource && (
          <div className="flex items-center gap-2 mb-2">
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-500 rounded">
              Source: Revit
            </span>
            <span className="text-[10px] text-muted-foreground">
              via {
                matchSource === 'elementId'
                  ? 'ElementId'
                  : matchSource === 'globalId'
                    ? 'GlobalId'
                    : matchSource === 'typeIfcGuid'
                      ? 'Type IfcGUID'
                      : 'Multi-key'
              }
            </span>
          </div>
        )}
        {confidence && (
          <div className="flex items-center gap-2 mb-2">
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
              Confidence: {confidence}
            </span>
          </div>
        )}
        <PropRow label="Name" value={revitProps.elementName} />
        <PropRow label="Type" value={revitProps.elementType} />
        <PropRow label="Category" value={revitProps.category} />
        <PropRow label="Family" value={revitProps.family} />
        <PropRow label="Family Type" value={revitProps.familyType} />
        <PropRow label="Mark" value={revitProps.mark} />
        <PropRow label="ElementId" value={revitProps.revitElementId} />
        <PropRow label="Tag (IFC)" value={tag} />
        <PropRow label="GlobalId" value={revitProps.globalId} />
        <PropRow label="Model Version" value={revitProps.modelVersion} />
        <PropRow label="Source File" value={revitProps.sourceFile} />
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
          <IfcPropertiesView ifcProperties={ifcProperties} />
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
