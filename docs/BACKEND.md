# Backend foundation

## Architecture

Follow the PRD: Next.js/TypeScript handles public HTTP endpoints and authentication;
FastAPI will handle ingestion, parsing, embeddings, and orchestration. PostgreSQL owns
durable state, pgvector stores embeddings, and Redis handles throttling and later queues.
Auth.js is one of the PRD's permitted authentication choices. No hosting provider, paid
service, LLM, or embedding model has been selected or provisioned.

M0 currently implements the backend slice only. Creating database tables for later
features is part of the core-schema foundation; those features are not implemented.

## Identity and request boundaries

Email addresses are normalized on password registration and login. PostgreSQL enforces
email uniqueness. Duplicate registration is an atomic no-op and cannot change a password.
Passwords use Node's scrypt with a random 16-byte salt, N=131072, r=8, p=1, a 64-byte derived
key, and constant-time comparison. Missing accounts still incur a password derivation.
Passwords must contain 12–128 characters. Auth.js manages CSRF, OAuth, and encrypted JWT
session cookies. Sessions expire after one day. The `/api/me` lookup rejects deleted users.

Redis uses an atomic increment/expiry script. Login limits apply to both client and
normalized email; raw emails are HMACed before becoming rate-limit keys. Invalid auth
attempts and unavailable Redis do not bypass authentication. Registration errors do not
return SQL errors or credentials. Service-readiness errors do not expose connection strings.

Google login is conditionally configured, requires verified email, and retains Auth.js's
default account-linking protections. Live testing is pending the user's Google OAuth client.
No sign-in page has been authored; Paperpal UI will be connected later.

## Schema details

- `users`, `accounts`, `sessions`, and `verification_token` match the Auth.js PostgreSQL
  adapter. Password hashes live separately in `password_credentials`.
- `papers` contains public bibliography only, unique by DOI and provider/source ID.
- `source_documents` identifies a public source or an explicitly owned private upload.
  Chunks refer to this document, retain page/section/coordinates, and record embedding model.
- `library_items` link a user's paper to their own uploaded document. The composite foreign
  key also requires the document's paper to match the library item's paper.
- Owner-aware foreign keys constrain collection membership, chat scope, and extraction cells.
- Search results retain paper IDs. Chat citations are stored as structured JSON; claim-level
  validation is still required in M2/M4 and is not implied by JSON storage.
- Extraction cells track status, evidence quote/page, user edits, and verification. Evidence
  semantics and job execution remain M5 work; the schema does not claim to verify citations.

Migration SQL is immutable after release. Alembic is the schema-version authority. Runtime
readiness requires the expected revision. Update that requirement alongside future migrations.
Do not execute migrations concurrently; deployment runs a single migration job first.

## Remaining M0 work

1. Validate Compose and migration up/down/up against the deployed PostgreSQL version.
2. Supply Google OAuth client credentials and verify redirect/session/sign-out behavior.
3. Add account verification/recovery and a session-revocation strategy before public release.
4. Receive Paperpal tokens/components and the user's first-screen confirmation.
5. Connect approved sign-up/login/dashboard screens and run M0 acceptance checks.

Do not begin M1 ingestion/search until M0 acceptance passes unless the user explicitly
changes the milestone order. M1 will resolve corpus, provider/rate-limit, relevance benchmark,
embedding model, vector index, and ranking decisions; no placeholder AI output is being shipped.

## Reference documentation

- [Auth.js credentials](https://authjs.dev/getting-started/authentication/credentials)
- [Auth.js PostgreSQL adapter](https://authjs.dev/getting-started/adapters/pg)
- [Google provider](https://authjs.dev/getting-started/providers/google)
- [FastAPI application structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [PGlite extensions used by tests](https://pglite.dev/extensions/)
