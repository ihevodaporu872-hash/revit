import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveRevitColumns,
  mapRevitRowsToRecords,
  buildUploadCoverage,
} from '../revit-xlsx.js'

test('resolveRevitColumns prefers human-readable type columns', () => {
  const available = [
    'IfcGUID : String',
    'ID : Integer',
    'Type Name : String',
    'Type : ElementId',
    'Category : String',
    'Custom PSet',
  ]

  const { resolvedMap, mappedColumns } = resolveRevitColumns(available)
  assert.equal(resolvedMap.globalId, 'IfcGUID : String')
  assert.equal(resolvedMap.revitElementId, 'ID : Integer')
  assert.equal(resolvedMap.elementType, 'Type Name : String')
  assert.ok(mappedColumns.has('Type Name : String'))
  assert.ok(!mappedColumns.has('Custom PSet'))
})

test('mapRevitRowsToRecords maps and normalizes rows', () => {
  const rows = [
    {
      'ID : Integer': '101',
      'IfcGUID : String': '',
      'Name : String': 'Wall 01',
      'Area : Double': '12,50',
      'Volume : Double': '1.25',
      'Custom Meta': 'X',
    },
    {
      'ID : Integer': '',
      'IfcGUID : String': '',
      'Name : String': 'Invalid',
      'Area : Double': '',
      'Volume : Double': '',
    },
  ]
  const available = Object.keys(rows[0])
  const { resolvedMap, mappedColumns } = resolveRevitColumns(available)
  const { records, errors } = mapRevitRowsToRecords(
    rows,
    available,
    resolvedMap,
    mappedColumns,
    {
      projectId: 'proj-a',
      modelVersion: 'v-1',
      sourceFile: 'sample.xlsx',
    },
  )

  assert.equal(records.length, 1)
  assert.equal(errors.length, 1)
  assert.equal(records[0].project_id, 'proj-a')
  assert.equal(records[0].model_version, 'v-1')
  assert.equal(records[0].source_file, 'sample.xlsx')
  assert.equal(records[0].global_id, 'REVIT_EID_101')
  assert.equal(records[0].revit_element_id, 101)
  assert.equal(records[0].element_name, 'Wall 01')
  assert.equal(records[0].area, 12.5)
  assert.equal(records[0].volume, 1.25)
  assert.deepEqual(records[0].custom_params, { 'Custom Meta': 'X' })
})

test('buildUploadCoverage calculates row and key ratios', () => {
  const records = [
    { global_id: 'G1', revit_element_id: 100, type_ifc_guid: 'T1' },
    { global_id: 'G2', revit_element_id: null, type_ifc_guid: null },
  ]

  const coverage = buildUploadCoverage(records, 4)
  assert.equal(coverage.parsedRows, 4)
  assert.equal(coverage.validRows, 2)
  assert.equal(coverage.validRatio, 0.5)
  assert.equal(coverage.withGlobalId, 2)
  assert.equal(coverage.withElementId, 1)
  assert.equal(coverage.withTypeIfcGuid, 1)
})
