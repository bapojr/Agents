# Research workspace preview

> Search Papers was updated on 8 October 2026. See [SEARCH-PAPERS-REFERENCES.md](SEARCH-PAPERS-REFERENCES.md) for the current data flow and references UI. The preview boundary below describes the original implementation and remains applicable to other modes.

The October 2026 UI implements the post-prompt flows in the two user-supplied Consensus recordings. The recordings remain local and are not distributed with this repository.

## Flow map

- First recording, 0–40s: submit a question, inspect research activity, read a cited answer beside independently scrolling references.
- 45–110s: reopen the existing Paperpal filters; copy an answer or export sources; select and save references.
- 115–135s: switch references between cards, compact list, and a horizontally scrolling comparison table.
- 175–200s: expand the paper list into a full-width results view.
- 205–265s: open a paper and switch Overview, Snapshot, Attachment, Evidence, and Metadata; ask about the paper, save it, and inspect source passages.
- End of first recording: close references for a wider answer; choose or type a follow-up.
- Second recording: hover/click an inline citation, open the corresponding evidence, highlight its PDF passage and linked answer section.

Existing Paperpal Figma tokens in `agents.css` and `filters.css` govern colors, typography, spacing, radii, controls, sidebar, and filtering. New components are ResearchWorkspace, ReferenceResults, CitationChip, PaperReader, and SaveButton. The filter icon is still the user-approved Figma asset.

## Preview boundary

GitHub Pages serves a static, interactive UI. Every submitted prompt opens a clearly labelled Alzheimer’s/dementia example; it does not claim to answer arbitrary prompts. Follow-ups are captured without pretending that AI answered them. Research mode/source controls retain the selected UI settings but do not invoke a live index, library, or model. No user input or uploads are transmitted by these preview flows.

There are three verified source records. Missing citation counts, SJR ranks, and extraction values are not invented. Filters apply to reference records; they do not regenerate the fixed example synthesis. Papers missing requested metadata are excluded. Saves use this browser’s local storage, with session-only fallback. Export uses selected records when selection is nonempty, otherwise the visible records. CSV, BibTeX, and RIS are generated locally. Print / Save as PDF invokes the browser print dialog.

## Reader sources and licensing

- DeTure MA, Dickson DW. *The neuropathological diagnosis of Alzheimer’s disease*. Molecular Neurodegeneration (2019). DOI: https://doi.org/10.1186/s13024-019-0333-5. Original open-access PDF obtained from the Massachusetts General Hospital research site: https://www.nmr.mgh.harvard.edu/~tatiana/Speech_papers/The%20neuropathological%20diagnosis%20of%20Alzheimer%E2%80%99s%20disease.pdf
- Jack CR Jr et al. *NIA-AA Research Framework: Toward a biological definition of Alzheimer’s disease* (2018). https://pmc.ncbi.nlm.nih.gov/articles/PMC5958625/
- King A, Bodi I, Troakes C. *The Neuropathological Diagnosis of Alzheimer’s Disease—The Challenges of Pathological Mimics and Concomitant Pathology* (2020). https://pmc.ncbi.nlm.nih.gov/articles/PMC7463915/

The DeTure/Dickson paper is CC BY 4.0 (license on its first page). Its unchanged original PDF and all 18 rendered pages are included in `public/research/deture-2019/`. The app adds blue overlays at normalized coordinates measured from PDF glyphs. Reader rendering is page images, with an original PDF link for selectable text and accessibility. Other papers link to their verified open-access source; their attachments are not cached. The papers are historical examples, not current clinical guidance.

PDF extraction/rendering uses the local Python pdfplumber/pdfium tools; these are not runtime dependencies. The public bundle contains no user recordings or screenshots.

## Validation (5 October 2026)

- 46 Vitest tests pass, including source IDs, PDF coordinate bounds, combined filters, unknown metadata exclusion, CSV escaping, and BibTeX/RIS records.
- TypeScript check and the GitHub Pages production export pass.
- Browser checks at desktop width and 390 × 844: prompt submission, reference cards/list/table, selection and browser-local save persistence, text search, PDF availability filter and clear, citation preview, citation-to-PDF highlight, page navigation, Snapshot and Metadata tabs, follow-up submission, recent conversation restoration, and mobile panel close/reopen.
- Mobile document width equals viewport width (390px); no horizontal page overflow. The comparison table intentionally scrolls within its own container.
- Browser console reported no errors or warnings during the final interaction check.
- Export serialization is covered by tests. The in-app browser download-event observer timed out, so its file-delivery event was not verified. The export menu action completed in the UI.
