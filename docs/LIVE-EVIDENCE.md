# Live documents and grounded extraction

## Deployment status

PDF viewing can now use a separate public OA document service, independent of AI and account sign-in.
The hosted service URL is not configured yet. **Live AI extraction
has not been verified: no model API key/model or public backend is configured in this workspace.**
Do not enable the AI GitHub repository `RESEARCH_API_URL` variable until the backend, authentication,
model credentials, and live claim verification below pass. GitHub Pages cannot execute these services.
The existing OpenAlex search runs independently and remains available without them.

## Architecture

- Existing OpenAlex adapter retains canonical Work IDs and all supplied location metadata.
- Existing FastAPI service exposes internal, bearer-protected `/evidence` routes. It accepts a
  canonical Work ID, not a user-controlled PDF URL or claimed source text. It re-reads OpenAlex.
- Only `is_oa=true` provider locations are downloaded. Public HTTPS, certificate verification,
  DNS-pinned connections, public-address checks on every redirect, bounded bytes and timeouts.
  No authentication to publisher hosts, cookies, paywall workarounds, or guessed PDF URLs.
- PDF parsing and PNG rendering use pdfplumber/PDFium in a time/resource-limited child process.
  Pages retain word offsets and normalized bounding boxes. Text is chunked without crossing pages.
- A provider abstraction calls OpenAI Responses with a strict schema. Configuration is server-only.
  Original question, column names/instructions, title and actual passages are the model inputs.
- Exact quote verification rejects nonexistent passages/quotes. A second entailment call checks
  each proposed claim. Rejected or unsupported cells become `Not reported`; no supporting quote
  is invented. Model verification is fallible and does not constitute human scientific validation.
- Claims, evidence, passage and document IDs are generated deterministically. Page highlights are
  the actual word rectangles overlapping the exact quote offsets (Unicode code points).
- The existing PaperReader, Evidence cards, Attachment tab, dropdowns, and `.pdf-highlight` styles
  are reused. A small LiveDocument adapter displays the real page image from the source PDF.
  This preserves the previous image-page renderer without substituting the bundled example PDF.
- The same enriched Paper object powers table, list, citation popovers, reader and SearchAnswer.
  Claim buttons and table evidence links select the same evidence objects as the Evidence tab.
  Cross-paper synthesis and scoped follow-up generation remain explicitly unconnected.

## PDF-only deployment (no AI credentials)

Deploy the existing repository using `services/research/Dockerfile.documents`, from the repository
root as build context. It runs the shared secure OA document loader and page renderer in a separate
FastAPI entry point. No PostgreSQL, Redis, account login, internal token or OpenAI key is required.
It exposes only public scholarly document metadata and page images; no private uploads or AI routes.
The existing authenticated extraction API remains protected and unchanged.

- Container port: `PORT` supplied by the host, default `8000`; health endpoint: `/health`.
- Set `DOCUMENT_ALLOWED_ORIGINS=https://bapojr.github.io` (comma-separated exact origins).
- Optional `RESEARCH_OPENALEX_API_KEY` stays server-side.
- Use one process/worker. Downloads/parsing/rendering are serialized; busy requests return retryable
  429 errors, with a bounded request limiter (60/minute per direct peer, 120/minute globally).
  Forwarded client headers are deliberately not trusted. On a reverse-proxied deployment, the
  per-peer limit can apply to the proxy as a whole. This is a conservative preview limit.
- After the hosted service passes real-document verification, set GitHub repository variable
  `DOCUMENT_API_URL` to its HTTPS origin. Pages builds map it to `NEXT_PUBLIC_DOCUMENT_API_URL`.
- Keep `RESEARCH_API_URL` unset until AI/backend authentication is ready. Public document requests
  omit cookies and use their own URL; they never send model inputs or call the extraction route.
- Verify a real OpenAlex work returns `pdfStatus: available`, a versioned page URL returns an actual
  PNG, and the live Pages Attachment tab renders that page. Verify a blocked PDF reports its real
  failure. The host must permit outbound public HTTPS and Python subprocesses.

## API and configuration

Internal FastAPI routes (require `RESEARCH_INTERNAL_TOKEN`):

- GET `/evidence/capabilities`
- GET `/evidence/documents/W...` (`retry=true` invalidates failed acquisition)
- GET `/evidence/documents/W.../pages/N?version=DOCUMENT_ID`
- POST `/evidence/extract` `{workId,question,columns:[{id,label,question}]}`

Next.js `/api/evidence/*` is the browser-facing proxy. It requires a real Auth.js user session,
checks origin, applies Redis quotas, bounds input, and injects the internal service token.
Do not expose FastAPI's internal token or a model key in frontend configuration.
A production deployment must provide the existing account sign-in flow; the static preview's
Login button remains a notice, so authentication integration is also an activation requirement.
For Pages, session cookies must work between the UI and backend; browser third-party-cookie
restrictions may require a shared custom domain. CORS allows only `APP_ORIGIN` and `PAGES_ORIGIN`.

Server variables:

- `RESEARCH_SERVICE_URL` — internal FastAPI URL for the Next.js proxy
- `RESEARCH_INTERNAL_TOKEN` — existing internal service credential
- `RESEARCH_OPENAI_API_KEY` — configured only in FastAPI's environment
- `RESEARCH_EXTRACTION_MODEL` — an explicitly selected Responses/structured-output capable model
- `RESEARCH_OPENALEX_API_KEY` — optional provider key if needed
- `PAGES_ORIGIN=https://bapojr.github.io` — on the authenticated Next.js backend

Public build configuration: `NEXT_PUBLIC_RESEARCH_API_URL=https://BACKEND/api/evidence`.
The Pages workflow reads this from repository variable `RESEARCH_API_URL`; it is a URL, never a secret.
When absent, static deployment does not call an invented backend. The standard Next.js app uses
same-origin `/api/evidence`.

## Limits and honest states

- 12 MB, 60 PDF pages, 100,000 extracted characters, 25-second download budget, 40-second PDF
  subprocess timeout. Oversized, malformed, image-only or blocked PDFs retain an explicit reason;
  an available source abstract can be analysed instead. OCR is not connected.
- Only the first 20 free results are analysed; all retrieved results remain discoverable.
- Default and user-added columns use the same pipeline (up to 24 requested columns).
- Process-local document cache: 32 OA documents, one-hour TTL. Analysis cache: 100 results keyed
  by document, original question, columns, model and prompt version. Browser request cache: 150.
- Extraction is sequential with one model job per service process, a retry state for busy/error
  responses, and user quotas in the BFF. Deploy a single worker for this bounded v1 cache; larger
  deployments need shared job/cache storage. No claim of durable background jobs is made.
- Document version is checked when rendering pages, so an updated PDF cannot receive old highlights.
- Missing metadata is still missing; source abstracts are never passed off as full-text evidence.

## Verification

Automated tests cover exact offsets, explicit IDs, abstract provenance, absent source text,
invented quotes, entailment rejection, Pathway not reported, SSRF/private redirect rejection,
HTML masquerading as PDF, failed acquisition fallback, service authorization, unavailable AI,
cache reuse, real bundled PDF parsing regression, UI claim highlighting, and the 20/21 boundary.
Model test doubles exist only in tests and are not live verification or product data.

Validation: 127 frontend tests passed (7 opt-in live tests skipped), 38 Python tests passed,
TypeScript, Ruff and strict mypy passed, and both Next.js and GitHub Pages builds passed.

The PDF-only service was also exercised against live OpenAlex work `W3150543191`: seven
pages returned, page two served as a real PNG, Pages CORS allowed, and extraction remained false.
Container deployment and hosted/live-website verification are pending the hosting account.

Live document checks on 2026-10-09:
- Query: climate change coral reef biodiversity. OpenAlex `W3150543191` returned the real
  Frontiers PDF for DOI `10.3389/fevo.2021.636279`. Downloaded and parsed 7 pages, rendered
  pages 1 and 2 in the in-product Attachment viewer, checked page/zoom controls,
  and manually compared its visible title and source text with the page-aware parsed passages.
- Query: machine learning protein structure prediction. OpenAlex `W3162614523` supplied a
  ScienceDirect PDF location that returned non-PDF content. Correctly reported PDF failure and
  retained the genuine source abstract. No external access restrictions were bypassed.

Still required before public activation: real model-backed extraction on accessible PDFs and
abstract-only sources, manual claim/quote review, an Evidence click highlighting both generated
answer and actual PDF, and authenticated hosted-backend testing from GitHub Pages.

Sources: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[pdfplumber](https://github.com/jsvine/pdfplumber),
[PDFium Python API](https://pypdfium2.readthedocs.io/en/stable/python_api.html).
