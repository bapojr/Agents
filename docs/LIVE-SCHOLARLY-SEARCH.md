# Live scholarly search

## Architecture and real-results contract

`LIVE_SEARCH_ENABLED = true`. Search Papers has no example fallback. A new prompt—including a subsequent prompt in the conversation composer—starts a fresh live request. The original query stays in the session and search intent. Old requests are cancelled and stale responses cannot replace the new results.

`AgentsHome → ResearchWorkspace → usePaperSearch → searchScholarlyPapers → ScholarlyProvider → OpenAlexProvider → normalized Paper[]`

The service, query processor, transport, provider normalization, and pagination are under `apps/web/src/ui/scholarly`. They live inside the copied UI source tree because the existing Pages exporter intentionally copies that tree, without server routes or secrets. UI components do not construct provider requests. The existing Crossref implementation is isolated as an optional `CrossrefProvider`; it is never a silent fallback. Additional Semantic Scholar, PubMed, or Europe PMC adapters can implement the same interface.

The single `Paper` model in `paper-data.ts` powers response citations, hover cards, References, table rows, standard cards, and the reader. Every live record needs a provider ID and provenance entry. OpenAlex work IDs, DOI, PMID, provider record URLs, retrieval timestamps, original links, authors, publication dates, source type, citations, OA metadata, topic/field labels, and PDF URLs are retained when supplied. No quartile or verification state is inferred. Missing metadata stays absent and the UI shows unavailable states where needed.

Abstracts are reconstructed only from complete, valid `abstract_inverted_index` word positions. They are labelled source excerpts, not AI summaries. PDFs open the exact source-supplied URL; live PDFs never use the historical demonstration PDF pages. Publisher access and link availability remain controlled by the source.

## Query handling and ranking

The deterministic query processor removes request scaffolding, retains topic terms and negation, and does not add domain-specific synonyms or generated claims. It extracts explicit publication year ranges, since/after/before constraints, recent/latest requests, review requests, and author bylines. It preserves the user's original question separately.

- “Recent/latest papers” means the last five publication years; the UI states the applied range.
- “Since 2022” includes 2022; “after 2022” starts at 2023.
- “Systematic reviews” applies OpenAlex's broader review type while retaining “systematic” in the text query. It never invents a systematic-review metadata label.
- Explicit “papers by [name]” uses the quoted raw-author-name filter. This matches bylines, not a guaranteed unique person identity.
- Topic years (for example an outbreak in 2020) are not automatically publication filters.

OpenAlex relevance order is retained. Author/date-only queries use publication-date ordering. Existing reference toolbar filters/search/sort operate on the loaded records and do not rerun the research query; prompt-derived constraints are sent to the provider. Column/view changes do not fetch again.

## Pagination, duplicates, and grounding

The provider retrieves 50 records per page using its cursor. The service wraps that cursor with the originating query/filter/provider identity, preventing accidental reuse for another search. Pagination is independent of the 20-reference free table limit.

Deduplication uses DOI and canonical provider identifiers first. Exact normalized title + year + first author is a conservative fallback for long titles, and does not collapse records with conflicting known DOIs. Provider provenance is retained when records merge; relevance order and existing IDs stay stable. Short titles and incomplete author/year records are not merged by title alone.

Future synthesis can use `resolveRetrievedCitations`: a citation to an ID outside the retrieved set throws. AI synthesis and custom extraction remain future backend work; this integration does not fabricate those outputs.

## Access and deployment

The current OpenAlex API accepts keyless basic search and supplies browser CORS headers. This was verified from the deployed API and the browser. GitHub Pages calls the public API through the adapter with credentials omitted; no API key, secret, database connection, or paid service is embedded. No backend deployment is required for this keyless path.

Anonymous use is subject to OpenAlex's rate limits and availability. If a key or protected provider is added later, put it in a server environment and replace the transport with a same-contract backend endpoint. Never add it to a `NEXT_PUBLIC_*` variable or GitHub Pages artifact. A backend host has not been provisioned by this iteration.

Timeout, rate-limit, access denial, service unavailability, malformed JSON/records, and network failure produce distinct retry messages. None are converted to empty results or demo content. Genuine zero-result responses show “No relevant papers found.” No claim is made that zero search matches prove no research exists.

Official references inspected:
- [Authentication](https://help.openalex.org/api/authentication/)
- [Search, relevance and author bylines](https://help.openalex.org/api/searching/)
- [Publication filters](https://help.openalex.org/api/filtering/)
- [Cursor pagination](https://help.openalex.org/api/paging/)

## Verification

`pnpm check`, `pnpm test`, and `pnpm build:pages` check the static app. Deterministic tests cover normalization of a captured real OpenAlex record, absent metadata, safe links, abstract reconstruction, explicit query constraints, error classifications, abort/timeout, deduplication/provenance, provider substitution, cursor binding, and citation-set validation. Existing render tests cover 0/1/19/20/21/51 reference boundaries and error/loading/empty states.

Opt-in live verification:

```sh
RUN_LIVE_SCHOLARLY_TESTS=1 pnpm --dir apps/web exec vitest run tests/scholarly-live.test.ts
```

This calls real OpenAlex endpoints for Alzheimer's/dementia, air pollution/asthma, CRISPR/sickle cell disease, climate/coral biodiversity, and machine learning/protein structure. It re-fetches each first result by canonical work ID and compares title, authors, year, DOI and URL. It also tests the nonsense query and fetches the next result page. These tests are excluded from ordinary CI to avoid requiring network availability or spending provider quotas on every commit. Captured test metadata is never imported by the application.
