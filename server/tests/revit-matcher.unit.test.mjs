import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMatchReport } from '../revit-matcher.js'

function ifcElement(overrides = {}) {
  return {
    expressID: 1,
    type: 'IFCWALL',
    name: 'Wall A',
    globalId: 'G-1',
    tag: '101',
    properties: [],
    ...overrides,
  }
}

function revitRow(overrides = {}) {
  return {
    global_id: 'G-1',
    revit_element_id: 101,
    revit_unique_id: 'UID-1',
    type_ifc_guid: 'T-1',
    element_name: 'Wall A',
    category: 'Wall',
    ...overrides,
  }
}

test('buildMatchReport matches by GlobalId and ElementId with high confidence', () => {
  const report = buildMatchReport({
    ifcElements: [ifcElement()],
    revitRows: [revitRow()],
  })

  assert.equal(report.totalIfcElements, 1)
  assert.equal(report.totalRevitRows, 1)
  assert.equal(report.totalMatched, 1)
  assert.equal(report.matchRate, 1)
  assert.equal(report.matchedByKey.globalId, 1)
  assert.equal(report.ambiguous.length, 0)
  assert.equal(report.missingInIfc.length, 0)
  assert.equal(report.missingInRevit.length, 0)
})

test('buildMatchReport marks ambiguous when top candidates tie', () => {
  const report = buildMatchReport({
    ifcElements: [ifcElement({ globalId: '', tag: '101' })],
    revitRows: [
      revitRow({ global_id: '', revit_unique_id: 'A' }),
      revitRow({ global_id: '', revit_unique_id: 'B' }),
    ],
  })

  assert.equal(report.totalMatched, 0)
  assert.equal(report.ambiguous.length, 1)
  assert.equal(report.missingInRevit.length, 1)
  assert.ok(report.diagnostics.some((d) => d.reason === 'duplicate_element_id' || d.reason === 'ambiguous_score_band'))
})

test('buildMatchReport returns unmatched diagnostics when no candidate exists', () => {
  const report = buildMatchReport({
    ifcElements: [ifcElement({ globalId: 'NOPE', tag: null })],
    revitRows: [revitRow()],
  })

  assert.equal(report.totalMatched, 0)
  assert.equal(report.ambiguous.length, 0)
  assert.equal(report.missingInRevit.length, 1)
  assert.ok(report.diagnostics.some((d) => d.reason === 'missing_tag' || d.reason === 'no_candidate'))
})
