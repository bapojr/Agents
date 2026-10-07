# Search Papers references (8 October 2026)

## Scope and architecture

This iteration replaces the fixed Alzheimer example **only for Search papers** with query-dependent Crossref retrieval. Other research modes retain their explicitly labelled preview. The user authorized this slice ahead of the original PRD milestones; it is not completion of the full ingestion/RAG/billing backend.

- `paper-data.ts` normalizes provider records. Unknown metadata stays absent. API content is rendered as text; no provider HTML is injected.
- `use-paper-search.ts` retrieves 50 records per page, explicitly sorted by relevance, with an opaque cursor for more results. It cancels abandoned requests and caches up to ten query result sets in memory. Filters, column controls, and view changes do not send another search request.
- Search response citations, source cards, standard cards, the table, and the existing reader consume these same records. Reference IDs are normalized DOI IDs. Duplicate provider records merge by ID.
- The browser sends the research query to the public Crossref API. Uploads are not sent. GitHub Pages remains a static deployment without secret keys.
- Responses display source metadata and publisher abstract excerpts, labelled as such. AI synthesis, claim verification, and enhanced/custom extraction are **not connected**. Crossref publication type is explicitly labelled, not treated as a study design. No Figma example research content is shipped in these views.

Crossref documentation: https://www.crossref.org/documentation/retrieve-metadata/rest-api/ and https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/

## References and entitlement boundary

References is closed when a new search starts. Each entry from a References button, Papers tab, or reader back action selects the table. View selection is not persisted.

`FREE_TABULAR_REFERENCE_LIMIT = 20` and `referencePartition` provide the common limit. Table view renders the first 20 visible records, an upgrade nudge only if more exist, then the remainder through `StandardReference`. Standard view renders all loaded references as standard cards. More provider matches are available through cursor pagination. Search within References and filters operate on loaded records; the loaded count is shown separately from the provider total.

`requestReferenceExport` checks entitlement before invoking any exporter. The current trusted state is free, so Export only opens `ReferencePaywall`. No checkout, plan mutation, or download is simulated. The paywall follows the Figma layout; unconfigured prices, discounts, word allowances, and guarantees are not represented as live offers. A real deployment must obtain entitlements from an authenticated backend and enforce paid extraction/export there; this static preview is not a security boundary.

## Components and design

Reused: Popover, SelectionDropdown, FigmaAsset, Paperpal tokens, native dialog pattern, workspace resize controls, existing reader, secondary buttons, and follow-up suggestions.

New shared components: StandardReference, PaperMetadata, PaperActions, SourceCitation, ColumnManager, TableReferences, ReferencePaywall, SearchAnswer.

Visual sources:
- Research Card `SiFoH7QKDRXquoHnC2z5FA`, nodes `358:10006` and `358:11427`.
- Paperpal Landing Pages `FgnpnRGUrLM52yxKYWJ1vP`, table `1186:5319`, controls `1647:43059`, paywall `1235:143801`, column menu `1223:10575` / `1225:10663`.
- The user's latest Add Column screenshot defines required Column Name, optional Instructions, Cancel, and disabled-until-valid Create. This form uses the existing Paperpal fields/buttons. Columns appear immediately; unsupported extraction cells say “Not extracted.” Suggested/default columns can be hidden/restored; custom columns can be deleted.
- IBM Plex Sans and minimum 12px are retained per the user's prior override of the table's Inter/sub-12px text.
- Exact Figma SVG assets are stored locally. Provider logos/badges are conditional, not copied onto unrelated papers.

Source hover cards are portalled above the conversation, reposition to viewport bounds, provide a pointer exit delay, open on focus/click, and support ArrowDown to enter and Escape to dismiss. Long author lists expand; missing metadata is omitted rather than fabricated.

Consensus is behavioral only. The earlier recording flow map is in `RESEARCH-WORKSPACE.md`; original recordings remain local. The supplied screenshots show the table → nudge → standard references transition. This implementation uses the requested 20-paper limit and Paperpal visuals.

## Verification

Automated tests cover normalization, missing metadata, zero citation counts, long records, deduplication, cursor termination, encoded queries, API failure/abort, metadata-dependent filtering, truthful abstract excerpts, custom columns, free export gating, and partitions of 0/1/7/19/20/21/50/10,000 records. Render tests check table versus card counts and nudge placement for 0/1/19/20/21/51 records, missing metadata, loading, errors, and empty results.

Browser verification includes real query retrieval, different citation cards, closed initial panel, table default on reopening, 20 rows + nudge + 30 cards, 50-card standard view, view/data retention, column toggles/create/delete, optional instructions, disabled Create, export paywall/no plan change, filtered one-result/no-nudge and zero-result states, desktop asset/font audit, and narrow-screen form layout. Additional pagination loaded 98 distinct records while retaining 20 table rows. Source cards fit a 390px viewport and Escape returns focus to the citation. TypeScript, 87 tests, and the GitHub Pages production export pass.
