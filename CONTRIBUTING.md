# Contributing

Thanks for helping! Bug reports, hardware build notes, docs fixes and code are all welcome.

## Before you start

- **Small fixes** (typos, docs, obvious bugs): just open a pull request.
- **New features or layouts:** open an issue first so we can agree on where it belongs. Most display changes live in
  the backend's screen composer (`api/src/modules/device/screens/screen-composer.ts`), not in the firmware.
- **Hardware experience:** if you built one with different parts, tell us in an issue or add it to
  [docs/hardware-guide.md](docs/hardware-guide.md).

## Setup

Follow [docs/deployment.md §4](docs/deployment.md#4-local-development-workflow). Node 24 (`.nvmrc`), Docker for PostgreSQL 18,
PlatformIO for firmware.

## Checks to run before a PR

```bash
npm run format && npm run typecheck:api && npm run test:api && npm run test:frontend
docker compose up -d pts-postgres && npm run test:integration   # if you touched anything database-related
(cd on-chip-software && pio test -e native)                     # if you touched firmware logic
```

What each suite covers is in [docs/testing.md](docs/testing.md). The rules that keep the three tiers compatible
(API security, device contract, firmware memory budget) are in [CLAUDE.md](CLAUDE.md).

TypeScript in `api/` and `frontend/` is formatted by Prettier with one shared config (`.prettierrc.json`); CI runs `npm run format:check`. Your editor picks up `.editorconfig` automatically.

## Pull requests

Keep them focused, describe the *why*, and update the docs that mention what you changed. The API↔firmware screen
contract is additive only (see [docs/api-reference.md §2.2a](docs/api-reference.md)).
By contributing you agree your work is released under the [MIT License](LICENSE).
