# Paper Snapshot

Scope: only the existing Paper → Snapshot tab. The Paper navigation, Overview, Attachment,
Evidence, Metadata, References, live search and existing PDF behavior are untouched.

The tab contains usage/generation controls, user-supplied blurred placeholder copy with readable
labels, seven study fields and a separate AI Summary. Values stack below labels in narrow
panels. Blur contains the user-specified field placeholders, not hidden research claims. Preview
content is excluded from the accessibility tree; generation progress, failure and retry are
announced. Reduced-motion preferences disable the loading pulse.

## Existing extraction integration

`src/ui/snapshot/service.ts` adapts the existing evidence service from the paused
`codex/live-document-evidence` work; it does not implement a second AI backend. Configure
`NEXT_PUBLIC_RESEARCH_API_URL` with the protected evidence API base URL. GitHub Pages reads
repository variable `RESEARCH_API_URL`. No server is silently assumed on the static site.

- GET `/capabilities`: existing `extraction` boolean.
- POST `/extract`: canonical OpenAlex work ID, a stable paper-summary question, seven requested
  study columns plus AI Summary. The existing server re-fetches canonical source text, acquires
  permitted PDFs where available, verifies verbatim quotes and verifies entailment.
- Optional future `snapshotUsage` in capabilities:
  `{remaining: number|null, unlimited: boolean, refillAt: ISO datetime|null, refillAmount: number|null}`.
  Unknown usage stays unknown; there is no invented allowance, refill, local decrement or
  simulated purchase. Real quota enforcement must happen on the authenticated backend.

The generated response must contain all eight cells. Claims without coherent evidence IDs,
claim IDs, document IDs, source scope and offsets display “Not reported”. Source quotations
can be inspected inline within Snapshot. Abstract-only generation is labeled explicitly.
Missing usable source text, incomplete responses, authentication, network, rate-limit and
service failures do not become successful cached results.

Results cache by canonical work ID and schema/prompt version within the browser session
(up to 30). Concurrent clicks/reopening reuse an in-flight promise. Revisiting a successfully
generated paper or reloading the tab reuses the result without another extraction request.
This is not a cross-device library or an entitlement database.

## Release status and verification

The live repository has no `RESEARCH_API_URL` configured. Backend hosting/AI credentials remain
paused. Therefore the UI and adapter are implementable now, but real AI generation on two live
papers cannot yet be verified or advertised as active. While no API URL is configured, clicking Generate now reveals an explicitly labelled fictional
Snapshot for design review, as requested by the user. Once an API URL is configured, the real
service path is used and errors never silently substitute sample results. Do not remove the existing site's unconnected-AI notice.

Automated tests cover preview/loading/generated/error states, dynamic/unknown/exhausted usage,
missing/invalid provenance, no source text, incomplete output, canonical IDs, retry, concurrent
requests, per-paper isolation, session restoration and cache reuse. Test-only API responses are
not scholarly results and are never shipped as application data.

Validation for this iteration: 133 frontend tests passed (7 opt-in live-provider checks skipped),
TypeScript and the GitHub Pages export passed. Browser checks used the live OpenAlex result
W2100190428, verified initial/failed-generation states, all seven labels and AI Summary, desktop
and 390px layouts with no Snapshot horizontal overflow, minimum 12px IBM Plex Sans, and
keyboard dismissal/focus restoration for the Snapshot upgrade dialog. Generated/cached real-result handling was checked through test-only service responses; this is not real-model verification.


## Requested visual sample mode (2026-10-13)

With no research API URL configured, Generate Snapshot displays filled sample copy about
walking breaks and concentration. It is explicitly labelled fictional and unrelated to the
open paper. The sample state is separate from `Snapshot`, real result persistence, reference
metadata, citations and evidence. It is retained per paper while the app remains open and
resets on reload. Connecting the API URL disables this mode; backend errors never activate it.

The blurred preview uses the exact eight strings requested by the user. Snapshot's Upgrade
CTA reuses UpgradeButton and its existing Prime artwork, with the Illustrate
`prompt-flow-prime` dimensions: 36px high, 14px horizontal padding, 8px gap, 6px radius,
IBM Plex Sans Medium 14px/18px, Blue 9 fill. The local line-height/icon-width tokens map the
inspected Illustrate source values. Other Upgrade buttons retain their existing appearance.
