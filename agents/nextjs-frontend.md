# Frontend (`frontend/`)

- Rules: [CLAUDE.md](../CLAUDE.md) section 2 (BFF architecture) and 2a (frontend conventions: MUI 9, CSS layers, Tooltip/link rules, BFF ownership checks).
- BFF routes live in `frontend/src/app/api/v1/*`; session handling in `frontend/src/helpers/session.ts`. Component overview: [docs/architecture.md §1.3](../docs/architecture.md).
- Next.js 16 has breaking changes: read `node_modules/next/dist/docs/` before writing code (see `frontend/AGENTS.md`).
- Commands: `npm run dev:frontend`, `npm run build:frontend`, `npm run test:frontend`, `npm --prefix frontend run typecheck`.
