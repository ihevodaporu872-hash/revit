# Revit/IFC/XLSX Quality Report (2026-02-10)

## Scope
- Branch: `feature/revit-ifc-xlsx`
- Focus: backend API hardening, parser + matcher core, Viewer UX for match/coverage, E2E flow with screenshots.

## Build and Test Results

| Layer | Command | Result |
|---|---|---|
| TypeScript + Vite build | `npm run build` | PASS |
| Unit + backend integration | `node --test server/tests/*.test.mjs` | PASS (`9/9`) |
| Viewer Revit regression subset | `npx playwright test e2e/03-viewer-revit.spec.ts --project=chromium` | PASS (`10/10`) |
| New fusion E2E | `npx playwright test e2e/17-revit-ifc-xlsx-fusion.spec.ts --project=chromium` | PASS (`1/1`) |

## Functional Coverage
- `GET /api/health`: includes converter feature-flag and DB preflight table checks.
- `POST /api/revit/upload-xlsx`: hardened parser contract, status semantics (`200/207/422/503`), mapped/unmapped columns, coverage metrics, guaranteed file cleanup.
- `POST /api/revit/properties/bulk`: explicit `projectId/modelVersion` filtering, limit handling, `unresolved` response section.
- `POST /api/revit/match-report`: multi-key scoring diagnostics (`matchRate`, `matchedByKey`, `ambiguous`, `missingInIfc`, `missingInRevit`, `byCategory`).
- `POST /api/revit/process-model`: `ENABLE_RVT_CONVERTER` gate + structured fallback (`manual_ifc_xlsx`) when converter unavailable.
- Viewer:
  - per-element and multi-selection color assignment.
  - set display modes include `transparent`, `isolate`, `wireframe`.
  - match report UI extended with ambiguous + diagnostic reason summaries.
  - coverage panel and stable `data-testid` selectors added for E2E.

## Dataset Check (`test_ifc_excel/*`)
- Input rows parsed: `3590`
- Valid Revit rows: `3589`
- IFC entities parsed (quality script): `7291`
- Matched: `1352`
- Match rate vs parsed IFC entities: `18.54%`
- Match mode split: `globalId=1320`, `elementId=32`, `typeIfcGuid=0`, `mixed=0`

Note:
- The current dataset does not reach the target `95%+ matched` threshold.
- Primary gap is cross-model identity continuity (GlobalId/ElementId linkage quality in provided IFC + XLSX pair), not parser stability.
- The implemented diagnostics now make mismatch reasons explicit and machine-actionable for follow-up mapping rules/overrides.

## Screenshot Artifacts
- `test-results/revit-ifc-xlsx/01-ifc-loaded.png`
- `test-results/revit-ifc-xlsx/02-revit-xlsx-imported.png`
- `test-results/revit-ifc-xlsx/03-match-coverage.png`
- `test-results/revit-ifc-xlsx/04-element-revit-props.png`
- `test-results/revit-ifc-xlsx/05-transparent-focus.png`
- `test-results/revit-ifc-xlsx/06-wireframe-mode.png`
- `test-results/revit-ifc-xlsx/07-unmatched-report.png`

## Acceptance Status

| Criterion | Status |
|---|---|
| No silent-fail in XLSX import | PASS |
| Structured infrastructure/fallback responses | PASS |
| E2E for IFC + XLSX + viewer states | PASS |
| Revit params displayed in IFC viewer for matched entries | PASS |
| `95%+ matched` on current reference dataset | FAIL (current measured: `18.54%`) |
