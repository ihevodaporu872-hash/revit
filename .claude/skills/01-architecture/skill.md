# Skill: Project Architecture (React + Vite + Express)

## Goal
Keep the project scalable, fast, and maintainable: SPA with React Router, Vite bundling, Express API backend.

## Principles
- Client-side SPA (no SSR). All components are client components.
- Data flows: React -> Zustand store -> API service -> Express backend
- Content/config in dedicated files, not hardcoded in JSX

## Project Structure
- `src/App.tsx` — React Router routes
- `src/components/{Module}/` — page components per module (8 modules)
- `src/components/ui/` — reusable UI primitives (Button, Card, Badge, etc.)
- `src/components/ui/shadcn/` — raw shadcn/ui components (do not modify)
- `src/components/Layout/` — Layout, Sidebar, TopBar, Notifications
- `src/lib/` — utilities (cn, formatters, animations)
- `src/services/api.ts` — API service layer with TypeScript types
- `src/store/appStore.ts` — Zustand global state
- `server/` — Express backend (port 3001)
- `e2e/` — Playwright tests (48 specs)

## 8 Modules
1. Converter — CAD/BIM file conversion
2. 3D Viewer — IFC viewer with Three.js + web-ifc
3. Cost Estimate — CWICR database + AI classification
4. Validation — BIM rules + scoring
5. AI Analysis — Gemini-powered data analysis
6. Project Mgmt — Kanban + Gantt + Telegram bot
7. Documents — Doc control + RFI + Submittals
8. QTO Reports — Quantity take-off + export

## DoD
- New feature doesn't break existing routes
- Components are reusable
- TypeScript strict mode, zero errors
- Vite build succeeds
