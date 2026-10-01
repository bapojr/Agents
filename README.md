# Agents

An AI research assistant for evidence-backed literature search, a personal paper library,
PDF conversations, and extraction tables. Requirements are in [docs/PRD.md](docs/PRD.md).

## Current status

**M0 foundation in progress.** The first Agents screen uses the approved Paperpal Figma
frame and reusable UI components. Search pipelines and generated research answers are not built.
M0 is not complete until sign-up, login, and the approved empty dashboard work together.
Later milestones remain blocked by the PRD's milestone gate.

Implemented:

- Next.js App Router server endpoints with Auth.js, email/password registration and sign-in,
  JWT sessions, and Google OAuth configuration when credentials are supplied.
- Salted scrypt password hashes, Redis throttling, same-origin registration checks, bounded
  JSON bodies, and generic duplicate-registration responses. Redis failures block registration.
- PostgreSQL/pgvector schema and Alembic migration covering identity and the initial research entities.
- Separate public metadata and document text; owner-aware foreign keys reject cross-user
  collection membership, chat scopes, extraction rows, and private PDF links.
- FastAPI liveness and authenticated readiness checks, Docker Compose infrastructure,
  pinned dependency locks, CI, and automated tests.

## Local development

Requirements: Node.js 24, pnpm 11.19.0, Python 3.12, and Docker with Compose.

```sh
python3 scripts/init_env.py
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/pip install -r services/research/requirements-dev.lock
.venv/bin/pip install --no-deps -e ./services/research
docker compose up --build -d
pnpm dev
```

The setup script creates an ignored, mode-0600 `.env` with random local secrets. It never
prints or overwrites secrets. Compose starts PostgreSQL, Redis, applies the migration,
and starts the internal research service. Next.js runs separately on localhost:3000.
The root URL displays the Agents research landing screen alongside the existing API routes.

### UI preview workflow

Use `pnpm dev` to start the local preview at **http://localhost:3000**. This command
loads the private root `.env`, binds only to this Mac, and uses port 3000 explicitly
so preview and authentication addresses stay aligned. If that port is occupied,
resolve the conflict rather than silently switching to another port.

During UI work, keep this address open in Codex's browser beside the chat or in a
regular browser. Next.js refreshes the preview as files change. Review each screen
and its interactions there before approving it. The preview is available while the
development server is running; it is not a public or shareable deployment.

Verify server availability with `http://localhost:3000/api/health/live`.
A healthy response is `{"status":"ok"}`.
This only checks the web server; sign-in and data operations additionally need
PostgreSQL and Redis from the Docker setup above.

For Google OAuth, configure a Google OAuth client in the deployment account, set
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env`, and register
`http://localhost:3000/api/auth/callback/google` for local development. Google sign-in
requires a verified Google email; automatic linking to an existing password account is disabled.
Real Google login requires those credentials and has not been live-verified.

### Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health/live` | Next.js liveness |
| `POST /api/register` | JSON name/email/password; same-origin requests only |
| `/api/auth/*` | Auth.js CSRF, providers, callbacks, sessions, sign-out |
| `GET /api/me` | Current signed-in user, no password fields |
| `GET :8000/health/live` | Research service liveness |
| `GET :8000/health/ready` | PostgreSQL migration + Redis readiness; internal bearer token required |

Use Auth.js's CSRF endpoint and cookie flow for password sign-in. A future Paperpal form
will call these endpoints; the configured `/sign-in` page deliberately does not exist yet.
Do not send the internal service token to a browser.

### Checks

```sh
pnpm check
pnpm test
pnpm build
.venv/bin/ruff check services/research
.venv/bin/mypy --config-file services/research/pyproject.toml services/research/src
.venv/bin/pytest services/research/tests
```

TypeScript integration tests execute the actual PostgreSQL SQL migration in PGlite with
pgvector and run the Auth.js credential/CSRF/session handlers. The Redis connection is mocked
in HTTP tests; fail-closed behavior is tested. Python tests cover readiness authentication,
dependency failure, and secret redaction. CI also applies, rolls back, and reapplies the migration
against PostgreSQL 17. The Docker stack must additionally be verified on a Docker-capable host.

## Boundaries before deployment

- This is a development foundation, not a production-ready release. Email verification,
  password recovery, session revocation, live OAuth validation, and deployment tests are pending.
- `APP_ORIGIN` and `AUTH_URL` must match; production requires HTTPS and a proxy that rejects
  unexpected hosts. Enable `TRUST_PROXY` only when the proxy overwrites `X-Forwarded-For`.
  With proxy trust off, requests share a conservative `unknown` rate-limit bucket.
- Use a private network, TLS, least-privilege database roles, encrypted storage/backups,
  managed secrets, and authenticated Redis in production. Compose exposes local ports only.
- Database constraints supplement authorization; every future data query must filter by the
  authenticated owner. No user-provided user ID is an authorization source. Row-level security
  and a separate restricted application DB role must be evaluated before exposing data APIs.
- Uploaded text is stored by source document, never in a globally shared paper row. Embedding
  dimensions and model-specific indexes are deliberately deferred until model selection.
- Deleting account rows does not remove object-store files automatically. A durable cleanup
  job is required before uploads ship in M3.
- The first-screen Figma values and components have been supplied and approved; use the
  source-backed tokens and handoff for subsequent changes.

## Hosted UI preview

The GitHub Pages preview is **https://bapojr.github.io/Agents/**. The `Publish Agents UI`
workflow builds and deploys it on pushes to `main`; it can also be run manually.

```sh
pnpm build:pages
```

This exports the same `src/app/page.tsx`, `layout.tsx`, `src/ui`, and local public assets
into `apps/web/.pages/out` with the `/Agents` base path. The generated `.pages` directory
is ignored. The exporter copies only these UI sources: no API routes, `.env` files,
database code, or server secrets. The normal `pnpm build` continues to build the full
Next.js server application without changing its configuration.

The preview includes Search papers as the default, reusable dropdowns, publication-year
filters behind a Font Awesome Filters control, suggestion-to-prompt selection, sidebar
expansion, new-research reset, and recent queries for the current page session. PDF
selection is local only; files are not uploaded. Voice input uses the browser's speech
recognition when supported and needs the user's microphone permission.

Search submission preserves a recent query and explicitly reports that live results are
not available. Authentication, library storage, connectors, document checks, and billing
are not connected to this static preview. The greeting uses the Figma example name Akash;
it is not a signed-in identity. Source-menu catalog copy is retained from Figma, not a
claim that an index has already been ingested. No research answers or papers are fabricated.

Design provenance and component IDs: [docs/FIGMA-HANDOFF.md](docs/FIGMA-HANDOFF.md).
Validation notes: [docs/UI-VALIDATION.md](docs/UI-VALIDATION.md).

See [docs/BACKEND.md](docs/BACKEND.md) for architecture decisions and remaining M0 work.
