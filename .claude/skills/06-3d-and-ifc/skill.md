# Skill: 3D Viewer & IFC Processing

## Goal
Provide Navisworks-like IFC viewing experience in the browser.

## Architecture
- Frontend: Three.js + web-ifc for 3D rendering ONLY
- Backend: Python + IfcOpenShell for property extraction
- Database: Supabase Postgres (JSONB + GIN indexes)

## Planned Navisworks Features (Tier 1)
1. Measure tools (point-to-point, area, angle)
2. Section planes / clipping box
3. Saved viewpoints
4. Selection Tree (spatial hierarchy)
5. Search Sets (dynamic saved filters)
6. Appearance Profiler (auto-color by property)
7. Redline / Annotations
8. Export to Excel
9. Box select
10. Zoom to selected / Zoom to fit

## Performance Rules
- Dispose Three.js geometries/materials on unmount
- Use InstancedMesh for repeated elements
- Max 50MB IFC file for browser rendering

## DoD
- 3D viewer renders without memory leaks
- Controls are smooth (60fps)
