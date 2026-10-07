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

The preview includes Search papers as the default, reusable dropdowns, a Figma-based
Filters dialog (years, PDF availability, open access, citations, fields of study, and SJR
quartiles), suggestion-to-prompt selection, sidebar
expansion, new-research reset, and recent queries for the current page session. PDF
selection is local only; files are not uploaded. Voice input uses the browser's speech
recognition when supported and needs the user's microphone permission.

Search submission opens the white Paperpal research workspace: a clearly labelled,
curated example answer, citation previews, card/list/table references, source filtering,
browser-local saves, CSV/BibTeX/RIS exports, and a five-tab paper reader. The reader includes
an attributed open-access PDF with all 18 pages and passage highlights. Follow-up prompts
and recent research are retained for the page session. Live search and AI follow-up answers
are not connected. Authentication, server library storage, connectors, document checks,
and billing are not connected to this static preview. The greeting uses the Figma example name Akash;
it is not a signed-in identity. Source-menu catalog copy is retained from Figma, not a
claim that an index has already been ingested. No research answers or papers are fabricated.

Design provenance and component IDs: [docs/FIGMA-HANDOFF.md](docs/FIGMA-HANDOFF.md).
Validation notes: [docs/UI-VALIDATION.md](docs/UI-VALIDATION.md).
Recorded flow mapping, source attribution, and preview boundaries:
[docs/RESEARCH-WORKSPACE.md](docs/RESEARCH-WORKSPACE.md).

See [docs/BACKEND.md](docs/BACKEND.md) for architecture decisions and remaining M0 work.

### Resizing the research side panel

Drag the divider between the conversation and references (or paper reader) to resize.
The desktop panel is 320–720px wide, with a dynamic maximum that reserves at least
480px for the conversation. The width is remembered in this browser. Double-click
the divider to restore its default proportion. The divider supports pointer capture
for mouse, pen and touch input, and keyboard Left/Right arrows (Shift for larger
steps), Home/End for the limits, Enter to close, and Escape to cancel a drag.
On screens up to 900px wide, or when both panes cannot fit, references use the
existing overlay instead. Panel controls, cards and the composer respond to their
container width; comparison tables retain horizontal scrolling.

Validation: production static build and browser checks cover dragging to the maximum,
minimum/maximum keyboard bounds, keyboard increments, reset, window resizing,
mobile overlay, and the paper reader at minimum width.

The reference toolbar groups Filters, Saved and Export immediately before the view
switch when its content area is at least 560px wide; narrower panels keep the two-row
layout. Shared dropdowns reuse Illustrate's white surface, 12px menu corners, 8px
padding, soft shadow, 40px minimum option rows, and blue selected text. Sort, PDF page,
zoom and quote selectors use the same Popover-based selection component, including
keyboard navigation, selected-state announcements, and Escape dismissal.

Secondary CTAs share Illustrate's 36px minimum height, 8px corners and IBM Plex Sans
14px medium text, using a grey outline and white fill. This includes References,
Filters, Save, Evidence, PDF, Copy/Export action menus, and outlined secondary actions.
Hover/pressed borders stay grey; primary actions retain their existing treatment.

Submitted questions and follow-ups match Illustrate’s prompt-flow bubble: right-aligned,
light grey, 12px corners, 16px/20px padding, and IBM Plex Sans 15px/22px medium text.
The bubble fits its content up to 440px or 85% of the conversation width, wrapping
long text and preserving entered line breaks. Paper-scoped follow-ups retain the source label.

### Conversation toolbar

The top-right toolbar provides a thread bookmark, citation settings, References,
secondary-style Share, and the same Upgrade CTA as the landing page. New searches
and shared preview threads start with references closed. The toolbar spans both
conversation and reference panes, and condenses to labelled icon buttons on mobile.

The bookmark dropdown saves the current thread to My Library or named collections,
with search, My favorites, and inline collection creation. This preview stores
threads and collections in this browser, not an account-backed library. Citation
preferences persist locally: author/year or numeric inline citations, plus APA, MLA,
Chicago, Harvard, BibTeX, or AMA/Numeric for citation copying and reference exports.
Text citations use the curated records' available metadata.

Share offers Copy thread link and Share to X (opens the X composer without posting).
Preview links encode the question and follow-ups in the URL fragment and restore
them on another browser; attachments and local library state are not included.
Upgrade retains the existing preview notice until billing is connected.

Validation covers share-link round trips and malformed input, library membership
and removal, citation preferences/exports, and desktop/mobile dropdown interactions.

Follow-up suggestions use AI Chat Figma `1302:57178`: a Blue 3–white gradient panel,
Gray 7 outline, 12px corners, 16px padding/gaps, dismiss control, and 52px minimum
white option rows. Width follows the research conversation; long questions wrap.
Number tiles use the supplied 14×14 sparkle SVG in Illustrate Blue 10 (#0054F1).
The original Figma close/chevron assets are stored locally; suggestions retain
their existing research follow-up behavior, and dismiss returns focus to the composer.
