# API (`api/`)

- Rules: [CLAUDE.md](../CLAUDE.md) sections 1 (security, access control, rate limiting), 1a (persistence), 1b (product rules) and 2b (API conventions).
- Endpoints and payloads: [docs/api-reference.md](../docs/api-reference.md). Env and migrations: [docs/deployment.md](../docs/deployment.md). Tests: [docs/testing.md](../docs/testing.md).
- Rate limits and the proxy setup they depend on: [docs/deployment.md §5](../docs/deployment.md#5-topology--reverse-proxy); definitions in `api/src/modules/shared-modules/config/throttling.ts`.
- Commands: `npm run test:api`, `npm --prefix api run test:e2e`, `npm run test:integration`, `npm run typecheck:api`, `npm run build:api`.
