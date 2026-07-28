# AGENTS.md - Noona AI Mobile

## Purpose
- Keep future Codex runs cheap: read this file first, then inspect only the files related to the task.
- This repository contains the React Native + Expo Router app for Noona AI.
- Prefer narrow, architecture-aligned changes over broad rewrites.

## Mobile Architecture
- Stack: Expo Router, React Native, TypeScript strict mode, React 19, Expo SDK 54.
- Routes live in `app/`.
- Shared UI lives in `components/`.
- Noona-specific UI lives in `components/noona/`.
- Theme constants live in `constants/theme.ts`.
- API clients live in `services/` and `utils/api.ts`.
- Hooks live in `hooks/`.
- Assets live in `assets/`; `assets/branding/noona-mascot.png` is the current mascot.

When changing mobile:
- Reuse `Screen`, `Text`, `Button`, `Card`, `MicButton`, `CorrectionBadge`, `StatPill`, and Noona components before creating new primitives.
- Keep API URL handling centralized through existing API helpers and `EXPO_PUBLIC_API_URL`.
- Respect Expo Router file conventions in `app`.
- Keep UI responsive for mobile first; avoid web-only assumptions.

## Local Commands
Run commands from the repository root:
- `npm install`
- `npm start`
- `npm run android`
- `npm run ios`
- `npm run web`
- There are currently no lint/test scripts in `package.json`; do not claim they passed unless scripts are added and run.

## Quality Gates
- Mobile changes: run `npm start -- --clear` only when interactive Expo verification is needed; otherwise at least run TypeScript checks if a script is added or available.

## Token-Saving Rules For Future Agents
- Start with `AGENTS.md`, `rg --files`, and the 1-3 files directly related to the task.
- Do not read `node_modules`, `.expo` unless necessary.
- Do not paste huge command outputs into the final answer; summarize key failures and exact file paths.
- Keep final responses short: changed files, verification run, and any blocked checks.

## Files To Treat Carefully
- `.env` - secrets/local config; do not commit or expose values.
- `node_modules/`, `.expo/` - local/generated.
