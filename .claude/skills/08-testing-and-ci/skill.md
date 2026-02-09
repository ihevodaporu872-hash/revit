# Skill: Testing & CI

## Goal
Don't break the platform as features grow.

## Current Setup
- Playwright E2E: 48 specs across 9 test files
- Run: `npx playwright test`

## What to Test After Changes
- After CSS changes: verify selectors still work
- After component rewrites: verify prop API unchanged
- After layout changes: verify sidebar collapse, navigation

## DoD
- All 48 E2E tests pass
- `npm run build` succeeds
- No TypeScript errors
