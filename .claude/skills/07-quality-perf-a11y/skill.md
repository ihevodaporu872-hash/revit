# Skill: Quality, Performance, Accessibility

## Goal
Fast SPA, accessible UI, no regressions.

## Performance
- Code splitting per route (React.lazy + Suspense)
- Three.js: dispose geometries/materials/textures on unmount
- Lazy load heavy modules

## Accessibility
- Semantic HTML tags
- Keyboard navigation
- Focus states, aria-labels
- Reduced motion support: `prefers-reduced-motion`

## DoD
- `npm run build` succeeds with zero TS errors
- All E2E tests pass
- Dark/light theme renders correctly
