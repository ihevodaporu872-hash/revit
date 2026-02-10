import path from 'path'
import { createHash } from 'crypto'

const TYPE_SUFFIX_RE = /\s*:\s*(String|Integer|Double|Boolean|ElementId)\s*$/i

const COLUMN_CANDIDATES = {
  globalId: ['IfcGUID : String', 'IfcGUID', 'GlobalId', 'Global Id', 'GUID', 'guid', 'GlobalID', 'Element GUID'],
  revitElementId: ['ID', 'ID : Integer', 'ElementId', 'Element Id', 'Revit Id'],
  revitUniqueId: ['UniqueId : String', 'UniqueId', 'Unique Id'],
  typeIfcGuid: ['Type IfcGUID : String', 'Type IfcGUID'],
  elementName: ['Name : String', 'Element Name', 'ElementName', 'Name', 'name'],
  // Intentionally prefer human-readable string type columns over ElementId columns.
  elementType: ['Type Name : String', 'Element Type', 'ElementType', 'Type : String', 'Type Name', 'Type', 'type'],
  category: ['Category : String', 'Category', 'category', 'Revit Category'],
  family: ['Family : String', 'Family Name : String', 'Family', 'family'],
  familyType: ['Family and Type : String', 'Family and Type', 'Family Type', 'FamilyType', 'Type Name : String'],
  level: ['Level : String', 'Level', 'level', 'Base Level', 'Reference Level'],
  phaseCreated: ['Phase Created : String', 'Phase Created', 'PhaseCreated', 'Phase', 'phase'],
  phaseDemolished: ['Phase Demolished : String', 'Phase Demolished', 'PhaseDemolished'],
  area: ['Area : Double', 'Area', 'area', 'Surface Area'],
  volume: ['Volume : Double', 'Volume', 'volume'],
  length: ['Length : Double', 'Length', 'length'],
  width: ['Width : Double', 'Width', 'width'],
  height: ['Height : Double', 'Unconnected Height', 'Height', 'height'],
  perimeter: ['Perimeter : Double', 'Perimeter', 'perimeter'],
  material: ['Material : String', 'Structural Material : String', 'Material', 'material', 'Structural Material', 'Material: Name'],
  materialArea: ['Material Area : Double', 'Material Area', 'MaterialArea', 'Material: Area'],
  materialVolume: ['Material Volume : Double', 'Material Volume', 'MaterialVolume', 'Material: Volume'],
  structuralUsage: ['Structural Usage : String', 'Structural Usage', 'StructuralUsage'],
  classification: ['Classification', 'OmniClass Number', 'Classification Code'],
  assemblyCode: ['Assembly Code', 'AssemblyCode', 'Assembly Description'],
  mark: ['Mark : String', 'Mark', 'mark', 'Type Mark'],
  comments: ['Comments : String', 'Comments', 'comments'],
}

export function normalizeColumnName(name) {
  return String(name || '')
    .replace(TYPE_SUFFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function resolveRevitColumns(availableColumns) {
  const resolvedMap = {}
  const mappedColumns = new Set()
  const lookup = new Map()

  for (const col of availableColumns) {
    const raw = String(col).trim()
    const normalized = normalizeColumnName(raw)
    const lowered = raw.toLowerCase().trim()
    if (!lookup.has(lowered)) lookup.set(lowered, raw)
    if (!lookup.has(normalized)) lookup.set(normalized, raw)
  }

  for (const [field, candidates] of Object.entries(COLUMN_CANDIDATES)) {
    for (const candidate of candidates) {
      if (availableColumns.includes(candidate)) {
        resolvedMap[field] = candidate
        mappedColumns.add(candidate)
        break
      }

      const found = lookup.get(candidate.toLowerCase().trim()) || lookup.get(normalizeColumnName(candidate))
      if (found) {
        resolvedMap[field] = found
        mappedColumns.add(found)
        break
      }
    }
  }

  // Avoid false positives for elementType when only ElementId-type technical fields are found.
  if (resolvedMap.elementType && /elementid/i.test(String(resolvedMap.elementType))) {
    delete resolvedMap.elementType
  }

  return { resolvedMap, mappedColumns }
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = String(value).replace(/\s+/g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseText(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function parseElementId(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number.parseInt(String(value), 10)
  return Number.isFinite(num) ? num : null
}

function nonEmpty(value) {
  return value !== '' && value !== null && value !== undefined
}

export function mapRevitRowsToRecords(rows, availableColumns, resolvedMap, mappedColumns, context) {
  const errors = []
  const records = []

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]

    const revitElementId = resolvedMap.revitElementId ? parseElementId(row[resolvedMap.revitElementId]) : null
    let globalId = resolvedMap.globalId ? parseText(row[resolvedMap.globalId]) : null

    if (!globalId && revitElementId) {
      globalId = `REVIT_EID_${revitElementId}`
    }

    if (!globalId) {
      errors.push({ row: i + 2, reason: 'Missing GlobalId and ElementId' })
      continue
    }

    const customParams = {}
    for (const col of availableColumns) {
      if (mappedColumns.has(col)) continue
      const val = row[col]
      if (nonEmpty(val)) customParams[col] = val
    }

    const getText = (field) => (resolvedMap[field] ? parseText(row[resolvedMap[field]]) : null)
    const getNum = (field) => (resolvedMap[field] ? parseNumber(row[resolvedMap[field]]) : null)

    records.push({
      project_id: context.projectId,
      model_version: context.modelVersion,
      source_file: context.sourceFile || null,
      global_id: globalId,
      revit_element_id: revitElementId,
      revit_unique_id: getText('revitUniqueId'),
      type_ifc_guid: getText('typeIfcGuid'),
      element_name: getText('elementName'),
      element_type: getText('elementType'),
      category: getText('category'),
      family: getText('family'),
      family_type: getText('familyType'),
      level: getText('level'),
      phase_created: getText('phaseCreated'),
      phase_demolished: getText('phaseDemolished'),
      area: getNum('area'),
      volume: getNum('volume'),
      length: getNum('length'),
      width: getNum('width'),
      height: getNum('height'),
      perimeter: getNum('perimeter'),
      material: getText('material'),
      material_area: getNum('materialArea'),
      material_volume: getNum('materialVolume'),
      structural_usage: getText('structuralUsage'),
      classification: getText('classification'),
      assembly_code: getText('assemblyCode'),
      mark: getText('mark'),
      comments: getText('comments'),
      custom_params: Object.keys(customParams).length > 0 ? customParams : {},
    })
  }

  return { records, errors }
}

export function buildUploadCoverage(records, parsedRows) {
  const withGlobalId = records.filter((r) => !!r.global_id).length
  const withElementId = records.filter((r) => Number.isFinite(r.revit_element_id)).length
  const withTypeIfcGuid = records.filter((r) => !!r.type_ifc_guid).length
  const validRows = records.length

  return {
    parsedRows,
    validRows,
    validRatio: parsedRows > 0 ? Number((validRows / parsedRows).toFixed(4)) : 0,
    withGlobalId,
    withElementId,
    withTypeIfcGuid,
  }
}

export function summarizeMappedColumns(resolvedMap) {
  return Object.entries(resolvedMap).map(([field, col]) => `${field} <- "${col}"`)
}

export function getUnmappedColumns(availableColumns, mappedColumns) {
  return availableColumns.filter((col) => !mappedColumns.has(col))
}

export function deriveModelIdentity(file, explicitProjectId, explicitModelVersion) {
  const base = `${file?.originalname || file?.name || 'model'}:${file?.size || 0}`
  const hash = createHash('sha1').update(base).digest('hex').slice(0, 12)
  const projectId = explicitProjectId && String(explicitProjectId).trim() ? String(explicitProjectId).trim() : `model-${hash}`
  const modelVersion = explicitModelVersion && String(explicitModelVersion).trim()
    ? String(explicitModelVersion).trim()
    : `v-${hash}-${Date.now()}`
  return {
    projectId,
    modelVersion,
    hash,
    sourceFile: file?.originalname || path.basename(file?.path || ''),
  }
}
