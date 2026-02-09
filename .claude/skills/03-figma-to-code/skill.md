# Skill: Figma -> Code via MCP

## Goal
Transfer Figma designs to React + Tailwind + shadcn accurately.

## When to Use MCP Figma
- User provides a Figma link to a frame/component
- Need to extract spacing/typography/colors/radii

## Process
1. Via Figma MCP get: sizes, constraints, text styles, components, tokens
2. Map to design system: colors -> CSS variables -> Tailwind tokens
3. Build layout: flex/grid, responsive breakpoints
4. Create reusable components in appropriate directories

## DoD
- Visually matches Figma design
- Code is clean and maintainable
- Design tokens used (not hardcoded colors)
