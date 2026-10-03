# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/DaRabus/public-transport-spy/security/advisories/new)
on this repository. Include what you found, how to reproduce it, and which component is affected
(`api/`, `frontend/` or `on-chip-software/`). Expect a first answer within a few days.

## Running your own instance

- Set unique `ADMIN_API_KEY` and `SESSION_SECRET` values (`openssl rand -hex 32`). The API refuses to start in
  production with a short or well-known key, and the frontend refuses to sign sessions without a real secret.
- Put the stack behind HTTPS (reverse proxy) before exposing it to the internet, and set `TRUST_PROXY=true` there.
- The pairing/token design and the threat model are in [docs/architecture.md](docs/architecture.md)
  ([security section](docs/architecture.md#3-security-architecture--threat-mitigation)).
