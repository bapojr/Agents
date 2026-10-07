"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowUpRightFromSquare, faBookmark, faCheck, faChevronDown, faCopy, faDownload, faFilePdf, faList, faMagnifyingGlass, faTable, faTableCellsLarge, faXmark } from "@fortawesome/free-solid-svg-icons";
import { Icon, icons } from "./figma-assets";
import { Popover } from "./popover";
import { SelectionDropdown } from "./selection-dropdown";
import { usePanelResize } from "./use-panel-resize";
import { emptyFilters, filterSummary, type ResearchFilters } from "./research-filters";
import { citation, downloadText, exampleQuestion, exportPapers, filterPapers, papers, type Evidence, type Paper } from "./research-preview";

export type ResearchSession = { id: number; query: string; followups: { question: string; paperId: string | null }[] };
type Tab = "Overview" | "Snapshot" | "Attachment" | "Evidence" | "Metadata";
type View = "cards" | "list" | "table";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const tabs: Tab[] = ["Overview", "Snapshot", "Attachment", "Evidence", "Metadata"];
const answerSections = [
  { title: "Alzheimer’s disease and dementia", body: "Alzheimer’s disease is a leading cause of dementia. Dementia describes a clinical syndrome; Alzheimer’s refers to a disease process that can give rise to that syndrome.", paper: 0, evidence: 0 },
  { title: "From pathology to cognitive impairment", body: "The 2018 NIA-AA research framework separates biological changes from cognitive symptoms. It describes Alzheimer’s as a continuum and considers the severity of cognitive impairment separately.", paper: 1, evidence: 0 },
  { title: "Dementia without Alzheimer’s pathology", body: "The reviewed literature also describes vascular disease, Lewy body disease, and other pathologies that can contribute to dementia or resemble the clinical presentation of Alzheimer’s.", paper: 0, evidence: 1 },
  { title: "Mixed and overlapping pathologies", body: "Different pathologies can coexist in the same person. The contribution of each to cognitive symptoms can be difficult to separate; overlap does not by itself mean that one dementia type turns into another.", paper: 2, evidence: 0 },
];

function Glyph({ icon }: { icon: typeof faCopy }) { return <FontAwesomeIcon icon={icon} aria-hidden="true" />; }
function SaveButton({ paper, saved, onSave }: { paper: Paper; saved: string[]; onSave: (id: string) => void }) {
  const yes = saved.includes(paper.id);
  return <button className={`rw-action ${yes ? "is-active" : ""}`} onClick={() => onSave(paper.id)} aria-pressed={yes} aria-label={`${yes ? "Unsave" : "Save"} ${paper.title}`}><Glyph icon={yes ? faCheck : faBookmark} />{yes ? "Saved" : "Save"}</button>;
}

function CitationChip({ paper, evidence, onOpen, onSave, saved, onCopy }: { paper: Paper; evidence: Evidence; onOpen: (p: Paper, tab: Tab, e?: Evidence) => void; onSave: (id: string) => void; saved: string[]; onCopy: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const preview = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!open || !root.current || !preview.current) return;
    const rect = root.current.getBoundingClientRect();
    const box = preview.current.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(root.current).getPropertyValue("--pp-s8"));
    setPosition({ left: Math.max(gap, Math.min(rect.left, window.innerWidth - box.width - gap)), top: rect.top > box.height + gap ? rect.top - box.height - gap : Math.min(rect.bottom + gap, window.innerHeight - box.height - gap) });
  }, [open]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <span ref={root} className="citation-wrap" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }} onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); setOpen(true); }} onMouseLeave={() => { timer.current = setTimeout(() => setOpen(false), 180); }} onKeyDown={e => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector("button")?.focus(); e.stopPropagation(); } }}>
    <button className="citation-chip" aria-expanded={open} aria-label={`Preview citation: ${paper.shortAuthor}, ${paper.year}`} onClick={() => setOpen(true)}>{paper.shortAuthor}, {paper.year}</button>
    {open && <span ref={preview} className="citation-preview" style={position} role="region" aria-label="Citation preview">
      <span className="rw-eyebrow">SOURCE · {evidence.section}{evidence.page ? ` · PAGE ${evidence.page}` : ""}</span>
      <button className="citation-title" onClick={() => { onOpen(paper, "Overview", evidence); setOpen(false); }}>{paper.title}</button>
      <span className="rw-muted">{paper.shortAuthor} · {paper.year} · {paper.journal}</span>
      <q>{evidence.text}</q>
      <span className="rw-actions"><button className="rw-action" onClick={() => { onOpen(paper, paper.pdf ? "Attachment" : "Evidence", evidence); setOpen(false); }}><Glyph icon={faFilePdf} />View evidence</button><SaveButton paper={paper} saved={saved} onSave={onSave} /><button className="rw-action" onClick={() => onCopy(citation(paper))} aria-label="Copy citation"><Glyph icon={faCopy} /></button></span>
    </span>}
  </span>;
}

function ReferenceResults({ items, view, selected, saved, onSelect, onSave, onOpen, onCopy }: { items: Paper[]; view: View; selected: string[]; saved: string[]; onSelect: (id: string) => void; onSave: (id: string) => void; onOpen: (p: Paper, tab: Tab) => void; onCopy: (text: string) => void }) {
  if (!items.length) return <div className="rw-empty"><Icon name={icons.search} /><h3>No matching example papers</h3><p>Try removing filters or changing your reference search. Citation counts and SJR ratings are not available in this example set.</p></div>;
  const checkbox = (p: Paper) => <input type="checkbox" checked={selected.includes(p.id)} aria-label={`Select ${p.title}`} onChange={() => onSelect(p.id)} />;
  if (view === "table") return <div className="reference-table-wrap" tabIndex={0} role="region" aria-label="Scrollable paper comparison"><table className="reference-table"><thead><tr><th scope="col">Paper</th><th scope="col">Key finding</th><th scope="col">Study design</th><th scope="col">Population / sample</th><th scope="col">Limitations</th></tr></thead><tbody>{items.map(p => <tr key={p.id}><td><div className="paper-title-row">{checkbox(p)}<button onClick={() => onOpen(p, "Overview")}>{p.title}</button></div><span className="rw-muted">{p.shortAuthor} · {p.year}</span></td><td>{p.finding}<button className="table-evidence" onClick={() => onOpen(p, "Evidence")}>View evidence ↗</button></td><td>{p.type}</td><td>Not extracted</td><td>{p.limitation}</td></tr>)}</tbody></table></div>;
  return <div className={`reference-results ${view}`}>{items.map(p => <article className="reference-card" key={p.id}>
    <div className="paper-title-row">{checkbox(p)}<span className="paper-number">{papers.indexOf(p) + 1}</span><button className="paper-title" onClick={() => onOpen(p, "Overview")}>{p.title}</button></div>
    <p className="paper-byline">{p.shortAuthor} · {p.year}<span>{p.journal}</span></p>
    <div className="paper-tags"><span>{p.type}</span><span>Open access</span>{p.pdf && <span>PDF available</span>}</div>
    {view === "cards" && <p className="paper-finding">{p.finding}</p>}
    <div className="rw-actions"><SaveButton paper={p} saved={saved} onSave={onSave} /><button className="rw-action" onClick={() => onOpen(p, "Evidence")}>Evidence</button><button className="rw-action" onClick={() => onCopy(citation(p))} title="Copy citation" aria-label={`Copy citation for ${p.shortAuthor}`}><Glyph icon={faCopy} /></button><a className="rw-action" href={p.url} target="_blank" rel="noreferrer" title="Open source" aria-label={`Open source for ${p.shortAuthor}`}><Glyph icon={faArrowUpRightFromSquare} /></a>{p.pdf && <button className="rw-action" onClick={() => onOpen(p, "Attachment")}><Glyph icon={faFilePdf} />PDF</button>}</div>
  </article>)}</div>;
}

function PaperReader({ paper, tab, setTab, evidence, onEvidence, onBack, onClose, onAsk, saved, onSave, onCopy }: { paper: Paper; tab: Tab; setTab: (t: Tab) => void; evidence?: Evidence; onEvidence: (e?: Evidence) => void; onBack: () => void; onClose: () => void; onAsk: (p: Paper) => void; saved: string[]; onSave: (id: string) => void; onCopy: (text: string) => void }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const scroll = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); setPage(1); }, [paper.id]);
  useLayoutEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [tab, paper.id]);
  useLayoutEffect(() => {
    if (tab !== "Attachment" || !evidence?.page || !scroll.current) return;
    const container = scroll.current;
    const target = container.querySelector<HTMLElement>(`[data-pdf-page="${evidence.page}"] .pdf-highlight`);
    setPage(evidence.page);
    if (target) container.scrollTo({ top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientHeight / 3 });
  }, [tab, evidence, zoom]);
  return <aside id="research-side-panel" className="paper-reader" aria-label="Paper reader">
    <div className="rw-panel-heading"><button className="rw-action" onClick={onBack}><Glyph icon={faArrowLeft} />References</button><button className="icon-button" aria-label="Close paper reader" onClick={onClose}><Glyph icon={faXmark} /></button></div>
    <div className="reader-heading"><span className="rw-eyebrow">PAPER {papers.indexOf(paper) + 1} · {paper.type}</span><h2 ref={title} tabIndex={-1}>{paper.title}</h2><p className="rw-muted">{paper.shortAuthor} · {paper.year}</p></div>
    <div className="reader-tabs" role="tablist" aria-label="Paper details">{tabs.map(t => <button key={t} id={`reader-${t}`} role="tab" aria-selected={t === tab} aria-controls="reader-content" tabIndex={t === tab ? 0 : -1} onClick={() => setTab(t)} onKeyDown={e => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next]); document.getElementById(`reader-${tabs[next]}`)?.focus(); } }}>{t}{t === "Evidence" && <span>{paper.evidence.length}</span>}</button>)}</div>
    {tab === "Attachment" && paper.pdf && <div className="pdf-controls"><div className="pdf-page-picker"><span>Page</span><SelectionDropdown label="PDF page" value={String(page)} onChange={value => { const n = Number(value); setPage(n); scroll.current?.querySelector(`[data-pdf-page="${n}"]`)?.scrollIntoView({ block: "start" }); }} options={Array.from({ length: paper.pages! }, (_, i) => ({ value: String(i + 1), label: `${i + 1} / ${paper.pages}` }))} /></div><SelectionDropdown label="PDF zoom" value={String(zoom)} onChange={value => setZoom(Number(value))} options={[100, 125, 150].map(n => ({ value: String(n), label: `${n}%` }))} /><a className="rw-action" href={`${base}${paper.pdf}`} target="_blank" rel="noreferrer" aria-label="Open original PDF"><Glyph icon={faArrowUpRightFromSquare} /></a></div>}
    {(tab === "Attachment" || tab === "Overview") && <div className="quote-selector"><span>Highlighted quote</span><SelectionDropdown label="Highlighted quote" value={evidence?.id || ""} onChange={value => onEvidence(paper.evidence.find(q => q.id === value))} options={[{ value: "", label: "None" }, ...paper.evidence.map((q, i) => ({ value: q.id, label: `${i + 1}. ${q.text}` }))]} /></div>}
    <div ref={scroll} id="reader-content" role="tabpanel" aria-labelledby={`reader-${tab}`} tabIndex={0} className={`reader-content ${tab === "Attachment" ? "pdf-content" : ""}`} onScroll={() => { if (tab !== "Attachment" || !scroll.current) return; const y = scroll.current.getBoundingClientRect().top; const visible = Array.from(scroll.current.querySelectorAll<HTMLElement>("[data-pdf-page]")).find(el => el.getBoundingClientRect().bottom > y + 40); if (visible) setPage(Number(visible.dataset.pdfPage)); }}>
      {tab === "Overview" && <><div className="paper-tags"><span>Open access</span><span>{paper.type}</span></div><h3>About this paper</h3><p>{paper.summary}</p><h3>Source passages</h3>{paper.evidence.map(q => <blockquote className={evidence?.id === q.id ? "selected-evidence" : ""} key={q.id}><p>“{q.text}”</p><button className="rw-action" onClick={() => { onEvidence(q); setTab(paper.pdf ? "Attachment" : "Evidence"); }}>{q.section}{q.page ? ` · Page ${q.page}` : ""} ↗</button></blockquote>)}<h3>Publication</h3><p>{paper.journal} · {paper.year}</p><a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">doi.org/{paper.doi}</a><p className="rw-muted">Selected passages and an editorial summary. Read the source for the full abstract and context.</p></>}
      {tab === "Snapshot" && <><span className="rw-eyebrow">CURATED EXAMPLE SNAPSHOT</span>{[["In brief", paper.finding], ["Background", paper.summary], ["Study design", paper.type], ["What to keep in mind", paper.limitation], ["Population and sample size", "Not extracted in this preview."]].map(([heading, body]) => <section className="snapshot-section" key={heading}><h3>{heading}</h3><p>{body}</p></section>)}<button className="outline-button" onClick={() => setTab("Evidence")}>Review supporting evidence</button></>}
      {tab === "Evidence" && <><p className="rw-muted">Select a passage to connect it to the answer and its source.</p>{paper.evidence.map((q, i) => <button className={`evidence-card ${evidence?.id === q.id ? "selected-evidence" : ""}`} key={q.id} onClick={() => { onEvidence(q); if (paper.pdf) setTab("Attachment"); }}><span className="rw-eyebrow">{i + 1} · {q.section}{q.page ? ` · PAGE ${q.page}` : ""}</span><q>{q.text}</q><span className="evidence-link">{paper.pdf ? "View passage in PDF ↗" : "Highlight linked claim"}</span></button>)}<a className="rw-action" href={paper.url} target="_blank" rel="noreferrer">Read full source <Glyph icon={faArrowUpRightFromSquare} /></a></>}
      {tab === "Metadata" && <dl className="metadata-list">{[["Title", paper.title], ["Authors", paper.authors.join(", ")], ["Year", String(paper.year)], ["Journal", paper.journal], ["Study type", paper.type], ["DOI", paper.doi], ["Attachment", paper.pdf ? `${paper.pages} pages · PDF` : "Not cached in preview"], ["Citation count", "Not available"], ["SJR quartile", "Not available"]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {tab === "Attachment" && (paper.pdf ? <><p className="pdf-attribution">DeTure & Dickson (2019) · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Original pages; blue highlights added.</p><div className="pdf-pages" style={{ width: `${zoom}%` }}>{Array.from({ length: paper.pages! }, (_, i) => <figure className="pdf-page" data-pdf-page={i + 1} key={i}><img loading={i ? "lazy" : "eager"} src={`${base}/research/deture-2019/page-${i + 1}.webp`} alt={`Page ${i + 1} of ${paper.title}. Open the original PDF for selectable text.`} width={953} height={1266} />{evidence?.page === i + 1 && evidence.rects?.map(([x, y, w, h], n) => <span aria-hidden="true" className="pdf-highlight" key={n} style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }} />)}<figcaption>Page {i + 1} of {paper.pages}</figcaption></figure>)}</div></> : <div className="rw-empty"><Glyph icon={faFilePdf} /><h3>Read the full-text source</h3><p>This paper’s PDF isn’t cached in the preview. Its verified source is available in a new tab.</p><a className="outline-button" href={paper.url} target="_blank" rel="noreferrer">Open full text ↗</a></div>)}
    </div>
    <footer className="reader-footer"><button className="primary-button" onClick={() => onAsk(paper)}><Icon name={icons.chat} />Ask this paper</button><SaveButton paper={paper} saved={saved} onSave={onSave} /><button className="rw-action" aria-label="Copy paper citation" title="Copy citation" onClick={() => onCopy(citation(paper))}><Glyph icon={faCopy} /></button>{paper.pdf && <a className="rw-action" href={`${base}${paper.pdf}`} download aria-label="Download paper PDF" title="Download PDF"><Glyph icon={faDownload} /></a>}</footer>
  </aside>;
}

export function ResearchWorkspace({ session, composer, filters, onFilter, onResetFilters, onFollowup, scope, onScope, modeLabel, source }: { session: ResearchSession; composer: ReactNode; filters: ResearchFilters; onFilter: () => void; onResetFilters: () => void; onFollowup: (q: string) => void; scope: string | null; onScope: (id: string | null) => void; modeLabel: string; source: string }) {
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState(true);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [evidence, setEvidence] = useState<Evidence>();
  const [view, setView] = useState<View>("cards");
  const [mainView, setMainView] = useState<"answer" | "papers">("answer");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("relevance");
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const askScope = papers.find(p => p.id === scope);
  const workspace = useRef<HTMLElement>(null);
  const resize = usePanelResize(workspace);
  const mobile = resize.compact;
  const initialLayout = useRef(false);
  const answerScroll = useRef<HTMLDivElement>(null);
  const floatingComposer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const composerElement = floatingComposer.current;
    const column = composerElement?.parentElement;
    if (!composerElement || !column) return;
    // Keep the last turn reachable when attachments, notices or mobile controls grow the composer.
    const measure = () => column.style.setProperty("--floating-composer-height", `${composerElement.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(composerElement);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!resize.ready || initialLayout.current) return;
    initialLayout.current = true;
    if (resize.compact) setPanel(false);
  }, [resize.ready, resize.compact]);
  const overlayOpen = mobile && (!!paper || panel && mainView === "answer");
  useEffect(() => {
    if (!overlayOpen) return;
    const aside = workspace.current?.querySelector<HTMLElement>("aside");
    aside?.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !aside || document.querySelector("dialog[open]")) return;
      const focusable = Array.from(aside.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, [tabindex="0"]')).filter(el => el.getClientRects().length && el.tabIndex >= 0);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !aside.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !aside.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap); return () => document.removeEventListener("keydown", trap);
  }, [overlayOpen, paper]);
  const returnFocus = useRef<HTMLElement | null>(null);
  const answerHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { const timer = setTimeout(() => { setReady(true); answerHeading.current?.focus(); }, 700); try { const stored: unknown = JSON.parse(localStorage.getItem("agents-saved-example-papers") || "[]"); if (Array.isArray(stored)) setSaved(stored.filter(id => typeof id === "string" && papers.some(p => p.id === id))); } catch { /* Storage may be disabled. */ } return () => clearTimeout(timer); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (session.followups.length) answerScroll.current?.scrollTo({ top: answerScroll.current.scrollHeight, behavior: "smooth" }); }, [session.followups.length]);
  const save = (id: string) => { const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id]; setSaved(next); try { localStorage.setItem("agents-saved-example-papers", JSON.stringify(next)); setToast(next.includes(id) ? "Saved on this browser." : "Removed from saved papers."); } catch { setToast("Saved for this session. Browser storage is unavailable."); } };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setToast("Copied to clipboard."); } catch { downloadText("agents-copy.txt", text); setToast("Clipboard unavailable. Downloaded a text file instead."); } setMenu(null); };
  const openPaper = (p: Paper, t: Tab, e?: Evidence) => { returnFocus.current = document.activeElement as HTMLElement; setPaper(p); setTab(t); setEvidence(e); setPanel(true); };
  const closePanel = () => { setPanel(false); setPaper(null); setEvidence(undefined); if (returnFocus.current?.isConnected) returnFocus.current.focus(); else document.getElementById("show-references")?.focus(); };
  const toggleSelect = (id: string) => setSelected(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const filtered = filterPapers(papers, filters, search).filter(p => (!savedOnly || saved.includes(p.id)) && (!selectedOnly || selected.includes(p.id)));
  const items = [...filtered].sort((a, b) => sort === "newest" ? b.year - a.year : sort === "oldest" ? a.year - b.year : 0);
  const exportItems = selected.length ? papers.filter(p => selected.includes(p.id)) : items;
  const exportFile = (format: "csv" | "bib" | "ris") => { downloadText(`agents-references.${format}`, exportPapers(exportItems, format), format === "csv" ? "text/csv;charset=utf-8" : "text/plain"); setMenu(null); setToast(`Exported ${exportItems.length} references.`); };
  const answerText = `Example research — curated preview\n${exampleQuestion}\n\n${answerSections.map(s => `${s.title}\n${s.body}`).join("\n\n")}`;
  const referenceControls = <><div className="rw-panel-heading"><div><h2>References <span className="count-badge">{items.length}</span></h2><p className="rw-muted">Source-checked example papers</p></div>{mainView === "answer" && <button className="icon-button" aria-label="Close references" onClick={closePanel}><Glyph icon={faXmark} /></button>}</div>
    <div className="reference-controls"><label className="reference-search"><Glyph icon={faMagnifyingGlass} /><input aria-label="Search references" placeholder="Search references" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="reference-toolbar"><SelectionDropdown className="reference-sort" label="Sort references" value={sort} onChange={setSort} options={[{ value: "relevance", label: "Source order" }, { value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} />
    <div className="reference-actions"><button className="rw-action" onClick={onFilter}><Icon name="filter-sliders" />Filters</button><button className={`rw-action ${savedOnly ? "is-active" : ""}`} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}><Glyph icon={faBookmark} />Saved ({saved.length})</button><Popover label="Export references" open={menu === "export"} onOpenChange={v => setMenu(v ? "export" : null)} className="export-menu secondary-action" trigger={<><Glyph icon={faDownload} />Export<Glyph icon={faChevronDown} /></>}>{([['csv', 'CSV spreadsheet'], ['bib', 'BibTeX'], ['ris', 'RIS']] as const).map(([f, label]) => <button role="menuitem" className="menu-option compact" disabled={!exportItems.length} key={f} onClick={() => exportFile(f)}>{label}</button>)}</Popover></div><div className="view-switch" aria-label="Reference display">{([['cards', faTableCellsLarge, 'Card view'], ['list', faList, 'List view'], ['table', faTable, 'Table view']] as const).map(([v, icon, label]) => <button key={v} className={view === v ? "active" : ""} aria-label={label} aria-pressed={view === v} onClick={() => setView(v)}><Glyph icon={icon} /></button>)}</div></div></div>
    {filterSummary(filters) !== filterSummary(emptyFilters()) && <div className="active-filter-summary"><span>{filterSummary(filters)}</span><button onClick={onResetFilters}>Clear</button></div>}
    <div className="selection-bar"><label><input type="checkbox" aria-label="Select all visible references" checked={items.length > 0 && items.every(p => selected.includes(p.id))} onChange={() => setSelected(items.every(p => selected.includes(p.id)) ? selected.filter(id => !items.some(p => p.id === id)) : [...new Set([...selected, ...items.map(p => p.id)])])} />{selected.length ? `${selected.length} selected` : "Select all"}</label>{selected.length > 0 && <><button onClick={() => { const next = [...new Set([...saved, ...selected])]; setSaved(next); try { localStorage.setItem("agents-saved-example-papers", JSON.stringify(next)); setToast("Selected papers saved on this browser."); } catch { setToast("Selected papers saved for this session."); } }}>Save selected</button><button aria-pressed={selectedOnly} onClick={() => setSelectedOnly(!selectedOnly)}>{selectedOnly ? "Show all" : "Selected only"}</button><button aria-label="Clear selection" onClick={() => { setSelected([]); setSelectedOnly(false); }}>×</button></>}</div></>;
  const results = <ReferenceResults items={items} view={view} selected={selected} saved={saved} onSelect={toggleSelect} onSave={save} onOpen={openPaper} onCopy={copy} />;
  return <main ref={workspace} className={`research-workspace ${panel && mainView === "answer" || paper ? "has-panel" : ""} ${mobile ? "is-compact" : ""} ${resize.dragging ? "is-resizing" : ""}`} style={resize.style} onKeyDown={e => { if (e.key === "Escape" && !menu) closePanel(); }}>
    <section className="answer-column" aria-label="Research workspace" inert={overlayOpen}>
      <div className="workspace-toolbar"><div className="workspace-tabs"><button className={mainView === "answer" ? "active" : ""} aria-pressed={mainView === "answer"} onClick={() => setMainView("answer")}><Icon name={icons.research} />Answer</button><button className={mainView === "papers" ? "active" : ""} aria-pressed={mainView === "papers"} onClick={() => { setMainView("papers"); setPaper(null); }}><Icon name={icons.papers} />Papers</button></div><button id="show-references" className="rw-action" onClick={() => { setMainView("answer"); setPaper(null); setPanel(!panel || !!paper); }} aria-expanded={panel && mainView === "answer"}>References <span className="count-badge">{papers.length}</span></button></div>
      <div ref={answerScroll} className="answer-scroll">
        {mainView === "papers" ? <div className="full-paper-results">{referenceControls}{results}</div> : <div className="answer-document">
          <div className="user-question"><span className="rw-eyebrow">YOUR QUESTION</span><p>{session.query}</p></div>
          <div className="preview-note"><span className="preview-dot" />Interactive preview · Showing the Alzheimer’s and dementia example. Live research is not connected.</div>
          <details className="research-activity"><summary><Icon name={icons.research} /><span>{ready ? "Example research ready" : "Preparing example workspace…"}</span><span className="rw-muted">3 steps</span><Glyph icon={faChevronDown} /></summary><ol><li><Glyph icon={faCheck} /><span>Load curated research question<small>{exampleQuestion}</small></span></li><li><Glyph icon={faCheck} /><span>Load 3 verified source records<small>Reviews and a research framework · 2018–2020</small></span></li><li><Glyph icon={faCheck} /><span>Connect passages and references<small>Includes one full, 18-page open-access PDF</small></span></li></ol></details>
          {!ready ? <div className="answer-loading" role="status" aria-label="Preparing example answer"><span /><span /><span /></div> : <article className="research-answer"><div className="answer-title-row"><span className="answer-brand"><Icon name={icons.research} />Paperpal</span><span className="rw-muted">Example synthesis</span></div><h1 ref={answerHeading} tabIndex={-1}>Understanding Alzheimer’s disease and dementia</h1><p className="answer-intro">Explore the relationship between the disease, cognitive decline, and overlapping pathologies through the selected literature.</p>
            {answerSections.map((s, i) => <section className={`answer-section ${evidence?.id === papers[s.paper].evidence[s.evidence].id ? "linked-claim" : ""}`} key={s.title}><h2>{s.title}</h2><p>{s.body} <CitationChip paper={papers[s.paper]} evidence={papers[s.paper].evidence[s.evidence]} onOpen={openPaper} onSave={save} saved={saved} onCopy={copy} /></p>{i === 1 && <div className="answer-comparison"><table><caption>Two different lenses in the cited framework</caption><thead><tr><th scope="col">Biological changes</th><th scope="col">Cognitive symptoms</th></tr></thead><tbody><tr><td>Amyloid, tau, and neurodegeneration</td><td>Severity of cognitive impairment</td></tr><tr><td>Characterize the disease process</td><td>Describe its clinical expression</td></tr></tbody></table><button className="table-evidence" onClick={() => openPaper(papers[1], "Evidence")}>Source: Jack et al., 2018 ↗</button></div>}</section>)}
            <div className="answer-takeaway"><strong>Reading the evidence</strong><p>These historical papers illustrate the research workflow. They are a small curated set, not a systematic review or current clinical guidance.</p></div>
            <div className="answer-actions"><button className="rw-action" onClick={() => { setPanel(true); setPaper(null); }}>References ({papers.length})</button><button className="rw-action" onClick={onFilter}><Icon name="filter-sliders" />Filters</button><Popover className="secondary-action" label="Copy or export answer" open={menu === "copy"} onOpenChange={v => setMenu(v ? "copy" : null)} trigger={<><Glyph icon={faCopy} />Copy<Glyph icon={faChevronDown} /></>}><button role="menuitem" className="menu-option compact" onClick={() => copy(answerText)}>Copy text</button><button role="menuitem" className="menu-option compact" onClick={() => copy(`Example research — curated preview\n${exampleQuestion}\n\n${answerSections.map(s => `${s.title}\n${s.body} (${papers[s.paper].shortAuthor}, ${papers[s.paper].year})`).join("\n\n")}\n\nReferences\n${papers.map(citation).join("\n\n")}`)}>Copy with citations</button><button role="menuitem" className="menu-option compact" onClick={() => { setMenu(null); window.print(); }}>Print / Save as PDF</button></Popover></div>
            <section className="followup-suggestions"><h2>Explore further</h2>{["How do mixed pathologies affect dementia?", "What are the limitations of these papers?", "How is Alzheimer’s pathology assessed?"].map(q => <button onClick={() => onFollowup(q)} key={q}><span>{q}</span><span aria-hidden="true">↗</span></button>)}</section>
          </article>}
          {session.followups.map((q, i) => <section className="followup-turn" key={`${i}-${q.question}`}><div className="user-question"><span className="rw-eyebrow">FOLLOW-UP{q.paperId ? ` · ${papers.find(p => p.id === q.paperId)?.shortAuthor}` : ""}</span><p>{q.question}</p></div><div className="followup-preview"><span className="answer-brand"><Icon name={icons.research} />Paperpal</span><p>Your follow-up is captured in this preview. Live answers will appear here when research is connected. Meanwhile, explore the source passages and snapshots alongside the answer.</p><button className="outline-button" onClick={() => openPaper(papers.find(p => p.id === q.paperId) || papers[0], "Evidence")}>Explore {q.paperId ? "this paper’s" : "source"} evidence</button></div></section>)}
        </div>}
      </div>
      <div ref={floatingComposer} className="workspace-composer">{askScope && <div className="ask-scope"><Icon name={icons.papers} /><span>Asking: {askScope.title}</span><button aria-label="Clear paper scope" onClick={() => onScope(null)}>×</button></div>}{composer}<p className="composer-context">{modeLabel} · {source} · Preview</p></div>
    </section>
    {(paper || panel && mainView === "answer") && !mobile && <div
      className="panel-resizer" role="separator" tabIndex={0} aria-label={paper ? "Paper reader width" : "References width"}
      aria-orientation="vertical" aria-controls="research-side-panel" title="Drag to resize. Double-click to reset."
      aria-valuemin={resize.min} aria-valuemax={resize.max} aria-valuenow={resize.width}
      aria-valuetext={`${resize.width} pixels`} aria-describedby="panel-resize-help"
      {...resize.separatorProps}
      onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); closePanel(); } else resize.separatorProps.onKeyDown(event); }}
    ><span aria-hidden="true" /><span id="panel-resize-help" className="sr-only">Drag or use Left and Right arrows to resize. Shift changes width faster. Home selects minimum width; End selects maximum. Enter closes the panel. Escape cancels an active drag. Double-click to reset.</span></div>}
    {paper ? <PaperReader paper={paper} tab={tab} setTab={setTab} evidence={evidence} onEvidence={setEvidence} onBack={() => { setPaper(null); setEvidence(undefined); if (mainView === "papers") setPanel(false); }} onClose={closePanel} saved={saved} onSave={save} onCopy={copy} onAsk={p => { onScope(p.id); if (mobile) { setPaper(null); setPanel(false); } const input = document.getElementById("research-question") as HTMLTextAreaElement | null; requestAnimationFrame(() => input?.focus()); }} /> : panel && mainView === "answer" && <aside id="research-side-panel" className="references-panel" aria-label="References">{referenceControls}<div className="reference-scroll">{results}</div><footer className="reference-footer">{items.length} of {papers.length} example papers · <button onClick={() => { setMainView("papers"); setPanel(false); }}>Expand results ↗</button></footer></aside>}
    {toast && <div className="workspace-toast" role="status"><Glyph icon={faCheck} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}>×</button></div>}
  </main>;
}
