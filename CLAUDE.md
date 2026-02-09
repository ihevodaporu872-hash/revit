# Jens Platform — Development Guide

## Stack
- **Frontend**: React 19 + Vite 6 + TypeScript 5.7 + Tailwind CSS v4
- **UI**: shadcn/ui (new-york style) + Framer Motion + Lucide React icons
- **State**: Zustand 5
- **3D**: Three.js + web-ifc + web-ifc-three
- **Charts**: Recharts
- **AI**: Google Gemini 2.0 Flash
- **Backend**: Express 4 (port 3001)
- **Testing**: Playwright E2E (48 specs)
- **Database**: Supabase Postgres

## Commands
- `npm run dev` — Vite dev server (port 5173)
- `npm run dev:server` — Express backend (port 3001)
- `npm run build` — TypeScript + Vite production build
- `npx playwright test` — Run all E2E tests

## Project Structure
```
src/
  App.tsx                    # React Router routes
  main.tsx                   # Entry point + ThemeProvider
  index.css                  # Tailwind v4 + CSS variables + dark theme
  components/
    ui/                      # Wrapper components (Button, Card, Badge, etc.)
      shadcn/                # Raw shadcn/ui primitives (DO NOT MODIFY)
    Layout/                  # Layout, Sidebar, TopBar, Notifications
    Converter/               # CAD/BIM Converter
    Viewer3D/                # 3D IFC Viewer
    CostEstimate/            # CWICR Cost Estimation
    Validation/              # BIM Validation
    AIAnalysis/              # AI Data Analysis
    ProjectMgmt/             # Project Management
    Documents/               # Document Control
    QTOReports/              # QTO Reports
  lib/
    utils.ts                 # cn(), formatters
    animations.ts            # Framer Motion presets
  services/api.ts            # API service layer
  store/appStore.ts          # Zustand global state
```

## Brand Rules
- Name: **Jens** (NEVER "DDC" or "datadrivenconstruction")
- Dark theme by default
- Primary color: blue-purple (hue 262)
- Premium, minimal, engineering aesthetic

## Color Tokens
| Token | Usage |
|-------|-------|
| `bg-background` | Page background |
| `bg-card` | Card/panel surfaces |
| `bg-muted` | Subtle backgrounds |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary text |
| `border-border` | Default borders |
| `bg-primary` | Brand color |
| `bg-destructive` | Danger/error |
| `bg-sidebar` | Sidebar background |

## Skills Mapping
| Task Type | Skills |
|-----------|--------|
| Architecture/routing | 01-architecture |
| UI/visual/branding | 02-ui-and-brand |
| Figma implementation | 03-figma-to-code |
| Component creation | 04-shadcn-and-tailwind |
| Charts/dashboards | 05-data-visualization |
| 3D viewer/IFC | 06-3d-and-ifc |
| Performance/a11y | 07-quality-perf-a11y |
| Tests/CI | 08-testing-and-ci |

## Critical Rules
- ALWAYS run `npm run build` before committing
- ALWAYS keep E2E tests passing
- NEVER modify files in `src/components/ui/shadcn/`
- Use CSS variable tokens, not hardcoded colors
- Use Framer Motion for animations
- ThemeProvider must wrap the entire app
