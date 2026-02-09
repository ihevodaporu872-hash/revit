# Skill: shadcn/ui + Tailwind CSS v4

## Goal
Use shadcn/ui as the UI foundation with Tailwind v4 CSS-first configuration.

## Setup
- shadcn components live in `src/components/ui/shadcn/`
- Wrapper components in `src/components/ui/` preserve existing API
- Tailwind v4 with `@theme inline` in `src/index.css`

## Color Tokens
Use semantic tokens, NOT hardcoded colors:
- `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`
- `bg-primary`, `bg-destructive`

## DoD
- Components follow shadcn patterns
- Dark/light theme works correctly
