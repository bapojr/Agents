"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FigmaAsset, Icon, icons, PaperpalLogo } from "./figma-assets";
import { ResearchWorkspace, type ResearchSession } from "./research-workspace";
import { Popover } from "./popover";
import { UpgradeButton } from "./upgrade-button";
import { sessionFromHash } from "./thread-state";
import { FilterDialog } from "./filter-dialog";
import { emptyFilters, filterSummary, type ResearchFilters } from "./research-filters";

const modes = [
  { id: "search", label: "Search papers", description: "Find relevant research.", icon: icons.search },
  { id: "research", label: "Research agent", description: "All-in-one research assistant", icon: icons.research },
  { id: "chat", label: "Chat with papers", description: "Upload papers & ask questions", icon: icons.chat },
  { id: "literature", label: "Literature review", description: "Find relevant research.", icon: icons.literature },
  { id: "web", label: "AI/Web search", description: "Search and get cited answers.", icon: icons.web },
] as const;
type ModeId = typeof modes[number]["id"];
const suggestions = [
  { label: "Search Papers", prompt: "Find papers on the impact of sleep deprivation on cognitive performance published after 2021", icon: icons.search, mode: "search" },
  { label: "Research-backed answers", prompt: "What does research say about the effects of intermittent fasting on metabolic health?", icon: icons.answers, mode: "research" },
  { label: "Comparison & Synthesis", prompt: "Compare the findings across studies on microplastics and human health", icon: icons.compare, mode: "research" },
  { label: "Ask questions", prompt: "What are the main mechanisms discussed across these papers on antibiotic resistance?", icon: icons.questions, mode: "chat" },
] as const;

type Recent = { query: string; mode: ModeId; source: string; filter: ResearchFilters; session?: ResearchSession };
type SpeechSession = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechSession; webkitSpeechRecognition?: new () => SpeechSession };

function Chevron() { return <FigmaAsset name="main-imgChevronDown" className="chevron" />; }

export function AgentsHome() {
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [paperScope, setPaperScope] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ModeId>("search");
  const [source, setSource] = useState("Public Research Papers");
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(0);
  const [filter, setFilter] = useState<ResearchFilters>(emptyFilters);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [listening, setListening] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const speech = useRef<SpeechSession | null>(null);
  const selectedMode = modes.find((item) => item.id === mode)!;
  const toggleMode = useCallback((value: boolean) => setOpen(value ? "mode" : null), []);
  const toggleSource = useCallback((value: boolean) => setOpen(value ? "source" : null), []);
  useEffect(() => () => { speech.current?.abort(); }, []);

  useEffect(() => {
    const restore = () => { const shared = sessionFromHash(window.location.hash); if (shared) { setSession(shared); setQuery(""); setPaperScope(null); } };
    restore(); window.addEventListener("hashchange", restore); return () => window.removeEventListener("hashchange", restore);
  }, []);
  const notify = (text: string) => { setNotice(text); setOpen(null); };
  const reset = () => {
    if (window.location.hash.startsWith("#thread=")) history.replaceState(null, "", window.location.pathname + window.location.search);
    setSession(null); setPaperScope(null); speech.current?.abort(); setListening(false); setQuery(""); setAttachments([]); setMode("search");
    setSelectedSuggestion(0); setFilter(emptyFilters()); setSource("Public Research Papers"); setOpen(null); setNotice("");
    textarea.current?.focus();
  };
  const submitQuestion = (value: string) => {
    if (!value.trim()) return;
    speech.current?.stop(); setOpen(null); setNotice("");
    if (session && mode !== "search") {
      const next = { ...session, followups: [...session.followups, { question: value.trim(), paperId: paperScope }] };
      setSession(next); setRecent(items => items.map(item => item.query === session.query ? { ...item, session: next } : item));
    }
    else {
      const item: Recent = { query: value.trim(), mode, source, filter };
      setRecent(items => [item, ...items.filter(previous => previous.query !== item.query)].slice(0, 7));
      setPaperScope(null);
      setSession({ id: Date.now(), query: value.trim(), followups: [] });
    }
    setQuery("");
  };
  const submit = () => submitQuestion(query);
  const voice = () => {
    if (listening) { speech.current?.stop(); return; }
    const Recognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Recognition) { notify("Voice input isn’t supported in this browser. You can type your question instead."); return; }
    const session = new Recognition(); speech.current = session;
    session.lang = "en-US"; session.interimResults = false; session.continuous = false;
    session.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ");
      setQuery((previous) => [previous.trim(), transcript.trim()].filter(Boolean).join(" "));
      textarea.current?.focus();
    };
    session.onerror = (event) => { setListening(false); notify(event.error === "not-allowed" ? "Microphone access was not granted. You can still type your question." : "Voice input stopped. Please try again or type your question."); };
    session.onend = () => setListening(false);
    try { session.start(); setListening(true); setNotice(""); } catch { notify("Voice input could not start. Please try again."); }
  };
  const filterLabel = filterSummary(filter);

  const composer = (<section className="composer-section" aria-label="Research composer">
          <div className="composer" data-node-id="875:86062">
            <label className="sr-only" htmlFor="research-question">Research question</label>
            <textarea ref={textarea} id="research-question" placeholder={session ? "Ask a follow-up question…" : "Ask agents to..."} value={query}
              onChange={(event) => { setQuery(event.target.value); setNotice(""); }}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
            {attachments.length > 0 && <div className="attachments" aria-label="Selected PDFs">{attachments.map((file, index) => <span className="file-chip" key={`${file.name}-${index}`} title="Selected locally; not uploaded">
              <Icon name={icons.papers} /><span>{file.name}</span><button aria-label={`Remove ${file.name}`} onClick={() => setAttachments((files) => files.filter((_, i) => i !== index))}>×</button>
            </span>)}</div>}
            <div className="composer-toolbar">
              <input ref={fileInput} type="file" accept="application/pdf,.pdf" multiple className="sr-only" tabIndex={-1} aria-label="Choose PDF files"
                onChange={(event) => {
                  const chosen = Array.from(event.target.files || []);
                  const pdfs = chosen.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
                  setAttachments((previous) => [...previous, ...pdfs].slice(0, 50)); event.target.value = "";
                  notify(pdfs.length === chosen.length ? "PDFs selected on your device. Uploading and paper analysis aren’t available in this preview yet." : "Please choose PDF files. Other file types were skipped.");
                }} />
              <button className="icon-button attach-button" aria-label="Add PDFs" title="Add PDFs" onClick={() => fileInput.current?.click()}><FigmaAsset name="main-imgPlus" /></button>
              <Popover label={`Research mode: ${selectedMode.label}`} open={open === "mode"} onOpenChange={toggleMode} className="mode-picker"
                trigger={<><Icon name={selectedMode.icon} /><span>{selectedMode.label}</span><Chevron /></>}>
                {modes.map((item) => <button type="button" role="menuitemradio" aria-checked={mode === item.id} key={item.id}
                  className={`menu-option ${mode === item.id ? "selected" : ""}`} onClick={() => { setMode(item.id); setOpen(null); setNotice(""); setSelectedSuggestion(item.id === "search" ? 0 : null); }}>
                  <span className="menu-title"><Icon name={item.icon} />{item.label}</span><span className="menu-description">{item.description}</span>
                </button>)}
              </Popover>
              <Popover label={`Paper source: ${source}`} open={open === "source"} onOpenChange={toggleSource} className="source-picker"
                trigger={<><Icon name={source === "Public Research Papers" ? icons.papers : icons.library} /><span>{source}</span><Chevron /></>}>
                <button role="menuitemradio" aria-checked={source === "Public Research Papers"} className={`menu-option ${source === "Public Research Papers" ? "selected" : ""}`} onClick={() => { setSource("Public Research Papers"); setOpen(null); }}>
                  <span className="menu-title"><Icon name={icons.research} />Public Research Papers</span><span className="menu-description">Search from 200M+ papers</span>
                </button>
                <button role="menuitem" className="menu-option" onClick={() => notify("Mendeley connection is coming soon.")}><span className="menu-title"><span className="icon-slot"><span className="mendeley-crop"><FigmaAsset name="main-imgImage3" /></span></span>Mendeley connect</span><span className="menu-description">Search your saved papers.</span></button>
                <button role="menuitem" className="menu-option" onClick={() => notify("Zotero connection is coming soon.")}><span className="menu-title"><span className="icon-slot"><span className="zotero-crop"><FigmaAsset name="main-imgImage5" /></span></span>Zotero connect</span><span className="menu-description">Search papers from Zotero.</span></button>
                <span className="menu-heading source-heading">My Library</span>
                <button role="menuitemradio" aria-checked={source === "All Collections"} className={`menu-option ${source === "All Collections" ? "selected" : ""}`} onClick={() => { setSource("All Collections"); notify("Your library is empty. Saved papers will appear here when library access is available."); }}><span className="menu-title"><Icon name={icons.library} />All Collections</span><span className="menu-description">Search all your saved papers</span></button>
                <button role="menuitem" className="menu-option compact" onClick={() => notify("No collections yet. Collections will be available with your paper library.")}><span className="menu-title"><Icon name={icons.collection} />Choose Collections</span></button>
              </Popover>
              <div className="filter-picker"><button type="button" className="selector filter-trigger" aria-label={`Filters: ${filterLabel}`} title={filterLabel}
                aria-haspopup="dialog" aria-expanded={open === "filters"} onClick={() => setOpen("filters")}><Icon name="filter-sliders" /><span>Filters</span></button></div>
              <div className="toolbar-end">
                <button className={`icon-button voice-button ${listening ? "is-listening" : ""}`} aria-label={listening ? "Stop voice input" : "Start voice input"} aria-pressed={listening} title={listening ? "Stop listening" : "Voice input"} onClick={voice}><FigmaAsset name="main-imgMicrophone" /></button>
                <button className="icon-button submit-button" aria-label="Submit research question" title="Send question" disabled={!query.trim()} onClick={submit}><FigmaAsset name="main-imgArrowTurnDownLeft" /></button>
              </div>
            </div>
          </div>
          {listening && <p className="listening-status" role="status">Listening… speak your question.</p>}
          {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
        </section>);

  return <div className={`agents-shell ${expanded ? "sidebar-expanded" : ""}`}>
    <a className="skip-link" href="#research-question">Skip to research question</a>
    <aside className="sidebar" aria-label="Paperpal sidebar" data-node-id="119:38944">
      <div className="sidebar-header">
        <button className="logo-toggle" type="button" aria-label={expanded ? "Paperpal home" : "Expand sidebar"}
          aria-expanded={expanded} onClick={() => expanded ? reset() : setExpanded(true)}>
          <PaperpalLogo expanded={expanded} /><span className="logo-hover"><FigmaAsset name="main-imgSidebarFlip" /></span>
        </button>
        {expanded && <div className="sidebar-header-actions">
          <button className="icon-button small" aria-label="Notifications" onClick={() => notify("You’re all caught up. No notifications yet.")}><FigmaAsset name="sidebar-imgBell" /></button>
          <button className="icon-button small" aria-label="Collapse sidebar" aria-expanded="true" onClick={() => setExpanded(false)}><FigmaAsset name="sidebar-imgSidebarFlip" /></button>
        </div>}
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <button className="nav-item create-new" onClick={reset} title="Start new research" aria-label="Start new research"><Icon name="main-imgFileCirclePlus" />{expanded && <span>Start New Research</span>}</button>
        <button className={`nav-item ${expanded ? "current" : ""}`} onClick={reset} aria-label="Home" aria-current="page" title="Home"><Icon name={expanded ? "sidebar-imgHouse1" : "main-imgHouse"} />{expanded && <span>Home</span>}</button>
        <button className="nav-item" onClick={() => notify("Document checks aren’t available in this preview yet.")} title="Checks" aria-label="Checks"><Icon name="main-imgBallotCheck" />{expanded && <><span>Checks</span><FigmaAsset name="sidebar-imgChevronRight" className="nav-chevron" /></>}</button>
      </nav>
      {expanded && recent.length > 0 && <section className="recents" aria-label="Recent research">
        <h2>Recents</h2>{recent.map((item) => <button key={item.query} title={item.query} onClick={() => {
          setSession(item.session || { id: Date.now(), query: item.query, followups: [] }); setPaperScope(null); setQuery(""); setMode(item.mode); setSource(item.source); setFilter(item.filter); setSelectedSuggestion(null);
          setNotice(""); textarea.current?.focus();
        }}>{item.query}</button>)}
      </section>}
      <div className="sidebar-account">
        {expanded ? <><button className="outline-button" onClick={() => notify("Sign-in isn’t available in this preview yet.")}>Login</button><button className="primary-button" onClick={() => notify("Account creation isn’t available in this preview yet.")}>Sign up for free</button></>
          : <button className="account-avatar" aria-label="Open account" title="Account" onClick={() => { setExpanded(true); setOpen(null); }}>
            <FigmaAsset name="main-imgEllipse19" /><FigmaAsset name="main-imgGroup1000005890" className="avatar-person" />
          </button>}
      </div>
    </aside>

    <div className="main-column">
      {!session && <header className="topbar">
        <nav className="breadcrumbs" aria-label="Breadcrumb"><button onClick={reset}>Home</button><FigmaAsset name="main-imgChevronRight" /><span aria-current="page">Agents</span></nav>
        <UpgradeButton onClick={() => notify("Prime upgrades aren’t available in this preview yet.")} />
      </header>}
      {session ? <ResearchWorkspace key={session.id} session={session} composer={composer} filters={filter} onFilter={() => setOpen("filters")} onResetFilters={() => setFilter(emptyFilters())} onFollowup={submitQuestion} scope={paperScope} onScope={setPaperScope} modeLabel={selectedMode.label} source={source} /> : <main className="research-main">
        <div className="agents-badge"><FigmaAsset name="main-imgSkywardIcons" /><span>Agents</span></div>
        <div className="greeting"><h1>Hi Sushrut, let’s dive in.</h1><FigmaAsset name="main-imgSparkles" className="greeting-sparkle" /></div>
        <p className="subtitle">What would you like to research today?</p>

        {composer}
        <section className="suggestions" aria-label="Research starting points">
          {suggestions.map((item, index) => <button className={`suggestion ${selectedSuggestion === index ? "selected" : ""}`} key={item.label} aria-pressed={selectedSuggestion === index}
            onClick={() => { setQuery(item.prompt); setMode(item.mode); setSelectedSuggestion(index); setNotice(""); textarea.current?.focus(); }}>
            <span className="suggestion-copy"><span className="suggestion-title"><Icon name={item.icon} /><span>{item.label}</span></span><span className="suggestion-prompt">{item.prompt}</span></span>
            <FigmaAsset name="main-imgStashArrowUpLight" className="suggestion-arrow" />
          </button>)}
        </section>
      </main>}
      {open === "filters" && <FilterDialog value={filter} onClose={() => setOpen(null)} onApply={value => { setFilter(value); setOpen(null); }} />}
    </div>
  </div>;
}
