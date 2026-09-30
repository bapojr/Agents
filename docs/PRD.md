# PRD: AI Research Assistant (working title: "Scholarly")

> Build instructions for Codex: Implement this PRD milestone by milestone (see Section 12). Do not start a later milestone until the current milestone's acceptance criteria pass. Ask before making architectural decisions that contradict this document. Keep all code typed, tested, and documented in the README.

---

## 1. Overview

**Product:** A web app that helps researchers, students, and clinicians find, read, compare, and synthesize academic literature using AI, with every claim traceable to a source paper.

**Reference products:** Consensus (evidence-based answers), Elicit (structured extraction across papers), SciSpace (chat with PDFs), Paperguide (research workflow + writing).

**One-line pitch:** Ask a research question, get a cited, evidence-grounded answer, then go deeper by extracting data from papers into tables and chatting with any PDF.

## 2. Problem Statement

- Literature search is slow: keyword search across Google Scholar, PubMed, etc. returns thousands of results with no synthesis.
- Reading papers is time-consuming, especially outside one's own field.
- Systematic and literature reviews require manually extracting the same fields (sample size, method, outcome) from dozens of papers.
- General-purpose LLMs hallucinate citations and cannot be trusted for academic work.

## 3. Goals and Non-Goals

### Goals
1. Return answers to research questions that are grounded in real, retrievable papers, with inline citations.
2. Let users build a personal library and run structured extraction across many papers.
3. Let users chat with a single paper or a set of papers with source-highlighted answers.
4. Zero fabricated citations: every citation must resolve to a real paper record in our index.

### Non-Goals (v1)
- Full manuscript writing / autocomplete editor
- Reference-manager sync (Zotero/Mendeley) beyond BibTeX/RIS import/export
- Mobile native apps (responsive web only)
- Team/enterprise features (SSO, shared workspaces)
- Access to paywalled full text beyond what the user uploads

## 4. Target Users and Personas

| Persona | Need | Key feature |
|---|---|---|
| Graduate student | Quickly understand a new field, find relevant papers | Ask, Summaries, Library |
| Researcher / postdoc | Systematic review, evidence tables | Extraction tables, Screening |
| Clinician / practitioner | "What does the evidence say about X?" | Evidence answer with consensus indicator |
| Undergraduate | Understand dense papers | Chat with PDF, simplified explanations |

## 5. Core Features (v1 scope)

### 5.1 Ask (Evidence Search)
- Natural-language question input (e.g., "Does intermittent fasting improve insulin sensitivity?").
- System retrieves top relevant papers, then generates a concise synthesized answer with inline numbered citations.
- Results list shows: title, authors, year, journal, citation count, abstract snippet, study type badge (RCT, meta-analysis, review, observational, etc.), and a "key finding" one-liner.
- Optional **Consensus Meter** for yes/no-style questions: distribution of Yes / Possibly / No / Mixed across retrieved papers, with links to each paper's classification and supporting sentence.
- Filters: year range, study type, min citation count, open access only, field/discipline.
- Save any result to Library; export results as CSV / BibTeX / RIS.

**Acceptance criteria**
- Every sentence in the generated answer that makes a factual claim has at least one citation marker.
- Every citation marker maps to a paper in the results list with a valid DOI or source ID.
- Answer generation is blocked (with a "not enough evidence" message) if fewer than 3 relevant papers are retrieved above the relevance threshold.
- P50 time to first results ≤ 4s; full answer streamed within ≤ 15s.

### 5.2 Library
- Users can add papers via: search results, DOI/URL paste, PDF upload (single and bulk, up to 50 files at once), BibTeX/RIS import.
- Papers are deduplicated by DOI, then by normalized title + first author + year.
- Folders/collections and free-text tags.
- Per-paper detail page: metadata, abstract, AI summary, PDF viewer (if available), notes.

**Acceptance criteria**
- Uploading a text-based PDF yields parsed metadata and full text within 60s.
- Duplicate imports are merged, not duplicated.

### 5.3 Chat with Paper(s)
- Chat with a single paper, a collection, or the whole library.
- Answers cite specific passages; clicking a citation opens the PDF at the page with the passage highlighted.
- Suggested starter questions (methods? limitations? sample size?).
- Explain-selection: highlight text in PDF viewer to get a plain-language explanation.

**Acceptance criteria**
- Answers are generated only from retrieved passages of the selected paper(s); if the answer isn't in the source, the assistant says so.
- Each citation includes page number and quoted span.

### 5.4 Extraction Tables (Elicit-style)
- User selects papers from Library (or a search result set) and creates a table where each row is a paper and each column is an extraction question.
- Preset columns: Population, Sample size, Intervention/Exposure, Comparator, Outcome, Key result, Study design, Limitations, Country, Funding.
- Custom columns: user writes a question or picks a column type (text, number, boolean, categorical).
- Each cell shows the extracted value plus a supporting quote and page reference; users can edit values and mark as verified.
- Export to CSV/XLSX.

**Acceptance criteria**
- Cells with no supporting evidence show "Not reported" rather than a guess.
- Extraction runs asynchronously with per-cell status (queued, running, done, failed) and can be retried.
- 50 papers x 8 columns completes in ≤ 5 minutes.

### 5.5 Paper Summaries
- One-click structured summary for any paper: TL;DR, background, methods, key findings, limitations, and "why it matters".
- Reading-level toggle: Expert / Simplified.

### 5.6 Literature Review Draft (stretch for v1, required for v1.1)
- From a collection, generate a structured outline and draft review sections with citations restricted to papers in the collection.

## 6. User Flows

1. **Quick answer:** Land on Home → type question → view answer + papers → save relevant papers → chat with a paper.
2. **Systematic extraction:** Create collection → import papers → create extraction table → review and verify cells → export.
3. **Read a paper:** Upload PDF → auto-summary → chat, highlight, ask questions → add notes.

## 7. Functional Requirements

### Accounts and Access
- Email + password and Google OAuth sign-in.
- Free tier limits (configurable): 10 searches/day, 5 PDF uploads/month, 1 extraction table (≤ 10 papers), 20 chat messages/day.
- Pro tier limits: effectively higher caps; billing via Stripe (subscription, monthly/annual).
- Usage metering stored per user and enforced server-side.

### Search and Retrieval
- Data sources (ingest via public APIs/datasets): OpenAlex, Semantic Scholar API, Crossref, PubMed/PMC, arXiv, Unpaywall (for open-access links).
- Hybrid retrieval: keyword (BM25) + dense embeddings, followed by a reranker.
- Study-type classification and per-paper "key finding" computed at ingest time or lazily and cached.

### AI Generation
- All generation must use retrieval-augmented prompts with explicit source passages.
- Citation verification step: after generation, a checker validates that each cited claim is supported by the cited passage; unsupported sentences are removed or flagged.
- LLM provider abstraction layer (swap models via config). Log model, prompt version, latency, and token usage per request.

### Ingestion and PDF Processing
- PDF parsing to text with page-level offsets (retain coordinates for highlighting), section detection, and reference stripping.
- OCR fallback for scanned PDFs (flag lower quality).
- Chunking: ~500-800 tokens with overlap, preserving section and page metadata.

## 8. Non-Functional Requirements

- **Trust:** No invented papers, DOIs, authors, or quotes. Citations are always generated from database records, never free-typed by the model.
- **Performance:** See acceptance criteria per feature; app shell loads < 2s on broadband.
- **Reliability:** Background jobs are idempotent and retryable; extraction failures don't block the table.
- **Privacy:** User uploads are private by default, encrypted at rest, deletable on request, and never used for model training.
- **Security:** OWASP top-10 mitigations, rate limiting, signed URLs for file access.
- **Accessibility:** WCAG 2.1 AA for core flows.
- **Observability:** Structured logs, error tracking, and product analytics events (see Section 11).

## 9. Suggested Technical Architecture

> Codex: these are defaults; propose alternatives in a short note before deviating.

- **Frontend:** Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, TanStack Table for extraction tables, react-pdf / PDF.js for viewer.
- **Backend:** Next.js API routes for CRUD; a separate Python service (FastAPI) for ingestion, parsing, embeddings, and LLM orchestration.
- **Database:** PostgreSQL with pgvector for embeddings; full-text search via Postgres `tsvector` (or OpenSearch if scale requires).
- **Queue/Jobs:** Redis + a worker (e.g., Celery or BullMQ) for PDF parsing, extraction, and bulk operations.
- **Storage:** S3-compatible object storage for PDFs.
- **Auth:** Auth.js (NextAuth) or Clerk.
- **Payments:** Stripe.
- **Deployment:** Docker Compose for local dev; deployable to Vercel (web) + Fly.io/Render/AWS (services).

### Core Data Model (initial)

- `users` (id, email, plan, created_at)
- `papers` (id, doi, title, authors[], year, venue, abstract, study_type, citation_count, oa_url, source, source_id, created_at)
- `paper_chunks` (id, paper_id, page, section, text, embedding)
- `library_items` (id, user_id, paper_id, pdf_file_id, notes, tags[], added_at)
- `collections` (id, user_id, name) and `collection_items` (collection_id, library_item_id)
- `searches` (id, user_id, query, filters, answer_text, created_at) and `search_results` (search_id, paper_id, rank, key_finding, classification)
- `chats` (id, user_id, scope_type, scope_id) and `chat_messages` (id, chat_id, role, content, citations[])
- `extraction_tables` (id, user_id, collection_id, name), `extraction_columns` (id, table_id, prompt, type), `extraction_cells` (id, table_id, column_id, paper_id, value, quote, page, status, verified)
- `usage_events` (id, user_id, type, tokens, cost, created_at)

## 10. Design and UX Principles

- Answer-first home screen: a single large question input, example queries, and recent activity.
- Evidence is always one click away: every claim links to a passage, every passage links to the PDF location.
- Clean, dense-but-readable, academic tone; light and dark themes.
- Show confidence and study quality signals (study type, sample size, citations) without over-claiming.
- Clear empty, loading, and error states for every async operation.

## 10a. Design System

Use the Paperpal design system for all UI.

**Source of truth** (use whichever is available, in this order):
1. [path to tokens/theme file or repo, e.g. /design-system/tokens.json]
2. [Figma file link / Storybook URL / component library package]
3. The token and component summary below

**Before building any screen:**
- Locate the Paperpal design system source above and list the tokens you found (colors, type scale, spacing, radii) and the components you will reuse.
- If you cannot find the source, STOP and ask me. Do not approximate or invent tokens.
- Wait for my confirmation before building the first screen.

**Rules:**
- Use only tokens from the design system. No hard-coded colors, font sizes, or spacing values.
- Reuse existing components before creating new ones; flag any new component you need.

## 11. Success Metrics

- Activation: % of new users who run a search within their first session (target ≥ 60%).
- Engagement: weekly active users; searches per user per week; % who save at least one paper.
- Depth: % of users who use chat, extraction, or summaries after a search (target ≥ 30%).
- Quality: citation verification pass rate (target ≥ 98%); thumbs-up rate on answers (target ≥ 75%).
- Extraction accuracy: ≥ 90% agreement with human-verified cells on an internal benchmark set.
- Conversion: free → paid (target 3–5%).

Track events: `search_submitted`, `answer_viewed`, `paper_saved`, `pdf_uploaded`, `chat_message_sent`, `extraction_table_created`, `cell_verified`, `export_clicked`, `upgrade_clicked`.

## 12. Milestones (build order for Codex)

**M0: Foundations**
- Repo setup, CI, lint/test config, Docker Compose, auth, base layout, DB migrations for core schema.
- *Done when:* a user can sign up, log in, and see an empty dashboard.

**M1: Paper index and search**
- Ingest a seed corpus from OpenAlex + PubMed; embeddings; hybrid retrieval + rerank; search results page with filters.
- *Done when:* keyword/semantic search returns relevant papers with metadata for 20 benchmark queries.

**M2: Ask (cited answers)**
- RAG answer generation with inline citations, citation verification, study-type badges, Consensus Meter.
- *Done when:* Section 5.1 acceptance criteria pass, including zero unresolved citations on the benchmark set.

**M3: Library and PDF ingestion**
- Uploads, DOI import, dedupe, collections/tags, PDF parsing and chunking, paper detail page, summaries.
- *Done when:* Section 5.2 and 5.5 acceptance criteria pass.

**M4: Chat with papers**
- PDF viewer with highlight-to-citation, single and multi-paper chat, explain-selection.
- *Done when:* Section 5.3 acceptance criteria pass.

**M5: Extraction tables**
- Table builder, async extraction jobs, evidence quotes, editing/verification, CSV/XLSX export.
- *Done when:* Section 5.4 acceptance criteria pass.

**M6: Monetization and polish**
- Usage limits, Stripe subscriptions, onboarding, analytics, accessibility pass, landing page.
- *Done when:* free-tier limits are enforced and a test subscription upgrades an account.

## 13. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Hallucinated citations or unsupported claims | DB-sourced citations only; post-generation verification; refuse when evidence is thin |
| Poor PDF parsing (columns, tables, scans) | Use a robust parser, OCR fallback, quality flag, manual re-parse option |
| API rate limits / data licensing | Cache aggressively, respect ToS, prefer open datasets (OpenAlex, PMC OA) |
| LLM cost overruns | Cache answers and extractions, tiered models, per-user usage caps |
| Paywalled content expectations | Clearly show OA status; support user PDF upload |
| Extraction errors misleading users | Evidence quote per cell, "Not reported" default, verify workflow |

## 14. Open Questions

1. Which disciplines to prioritize first (biomedical vs. all fields)?
2. Which LLM provider(s) and embedding model to standardize on?
3. Do we build our own index or rely on live API calls for v1?
4. Pricing: per-seat subscription vs. credit-based usage?
5. Do we need institution/library-proxy access for full-text in later versions?

## 15. Out of Scope for Now / Future Ideas

- Citation graph exploration and "related work" maps
- Systematic review screening (PRISMA workflow)
- Zotero/Mendeley two-way sync
- Collaborative workspaces and comments
- Browser extension for on-page paper summaries
- Writing assistant with citation-aware drafting