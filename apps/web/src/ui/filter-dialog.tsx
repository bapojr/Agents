"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FigmaAsset } from "./figma-assets";
import { studyFields, validateFilterNumbers, type ResearchFilters, type YearFilter } from "./research-filters";

function Radio({ selected, onChange, children, label }: { selected: boolean; onChange: () => void; children: ReactNode; label: string }) {
  return <label className="filter-radio-label"><span className="filter-radio">
    <input type="radio" name="publication-year" aria-label={label} checked={selected} onChange={onChange} />
    <FigmaAsset name={selected ? "filter-radio-ring" : "filter-radio-empty"} />
    {selected && <FigmaAsset name="filter-radio-dot" className="filter-radio-dot" />}
  </span>{children}</label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="filter-toggle-row"><span>{label}</span><button type="button" role="switch" aria-label={label}
    aria-checked={checked} className="filter-switch" onClick={() => onChange(!checked)}>
    <span className="filter-switch-knob"><FigmaAsset name="filter-switch-thumb" /></span>
  </button></div>;
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="filter-checkbox-label"><span className="filter-checkbox"><input type="checkbox" checked={checked} onChange={onChange} />
    <span className="filter-checkbox-box">{checked && <FigmaAsset name="filter-check" />}</span>
  </span><span>{label}</span></label>;
}

export function FilterDialog({ value, onApply, onClose }: { value: ResearchFilters; onApply: (value: ResearchFilters) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; y: number; scroll: number } | null>(null);
  const id = useId();
  const [kind, setKind] = useState<YearFilter["kind"]>(value.year.kind);
  const [years, setYears] = useState(value.year.kind === "last" ? String(value.year.years) : "");
  const [from, setFrom] = useState(value.year.kind === "custom" ? String(value.year.from) : "");
  const [to, setTo] = useState(value.year.kind === "custom" ? String(value.year.to) : "");
  const [hasPdf, setHasPdf] = useState(value.hasPdf);
  const [openAccess, setOpenAccess] = useState(value.openAccess);
  const [citations, setCitations] = useState(value.minCitations === null ? "" : String(value.minCitations));
  const [fields, setFields] = useState(value.fields);
  const [quartiles, setQuartiles] = useState(value.quartiles);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [error, setError] = useState("");
  const [scroll, setScroll] = useState({ position: 0, max: 0 });
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  useEffect(() => {
    const area = viewport.current!;
    const update = () => {
      const max = Math.max(0, area.scrollHeight - area.clientHeight);
      const travel = Math.max(0, (track.current?.clientHeight || 0) - (thumb.current?.clientHeight || 0));
      if (thumb.current) thumb.current.style.transform = `translateY(${max ? area.scrollTop / max * travel : 0}px)`;
      setScroll({ position: Math.round(area.scrollTop), max });
    };
    const observer = new ResizeObserver(update);
    observer.observe(area); if (area.firstElementChild) observer.observe(area.firstElementChild);
    area.addEventListener("scroll", update); update();
    return () => { observer.disconnect(); area.removeEventListener("scroll", update); };
  }, []);

  const toggleSelection = (items: string[], item: string) => items.includes(item) ? items.filter(x => x !== item) : [...items, item];
  const setYearKind = (next: YearFilter["kind"]) => { setKind(next); setError(""); };
  const stepYears = (delta: number) => { setYearKind("last"); setYears(String(Math.max(1, Math.min(currentYear, (Number(years) || 0) + delta)))); };

  return <dialog ref={dialog} className="filter-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    <form noValidate className="filter-dialog-form" onSubmit={event => {
      event.preventDefault();
      const message = validateFilterNumbers(kind, years, from, to, citations, currentYear);
      if (message) { setError(message); return; }
      const year: YearFilter = kind === "all" ? { kind } : kind === "last" ? { kind, years: Number(years) } : { kind, from: Number(from), to: Number(to) };
      onApply({ year, hasPdf, openAccess, minCitations: citations.trim() ? Number(citations) : null, fields, quartiles });
    }}>
      <div className="filter-scroll-viewport" ref={viewport} id={`${id}-scroll`}>
        <div className="filter-scroll-content">
          <header className="filter-dialog-header"><h2 id={`${id}-title`}>Filters</h2>
            <button type="button" className="filter-close" aria-label="Close filters" onClick={onClose}><FigmaAsset name="filter-close" /></button>
            <FigmaAsset name="filter-divider" className="filter-header-divider" />
          </header>
          <div className="filter-dialog-body">
            <fieldset className="filter-years"><legend>Publication Year</legend>
              <Radio label="All Years" selected={kind === "all"} onChange={() => setYearKind("all")}>All Years</Radio>
              <div className="filter-last-row"><Radio label="Last years" selected={kind === "last"} onChange={() => setYearKind("last")}>Last</Radio>
                <span className="filter-last-number"><input type="number" aria-label="Number of years" min="1" max={currentYear} value={years}
                  onFocus={() => setYearKind("last")} onChange={event => setYears(event.target.value)} /><FigmaAsset name="filter-underline" /></span>
                <span>Years</span><span className="filter-stepper"><button type="button" aria-label="Increase years" onClick={() => stepYears(1)}><FigmaAsset name="filter-step-up" /></button><button type="button" aria-label="Decrease years" onClick={() => stepYears(-1)}><FigmaAsset name="filter-step-down" /></button></span>
              </div>
              <Radio label="Custom" selected={kind === "custom"} onChange={() => setYearKind("custom")}>Custom</Radio>
              {kind === "custom" && <div className="filter-custom-years"><input type="number" aria-label="From year" placeholder="From year" min="1" max={currentYear} value={from} onChange={event => setFrom(event.target.value)} /><span>to</span><input type="number" aria-label="To year" placeholder="To year" min="1" max={currentYear} value={to} onChange={event => setTo(event.target.value)} /></div>}
            </fieldset>
            <div className="filter-metadata"><Toggle label="Has PDF" checked={hasPdf} onChange={setHasPdf} /><Toggle label="Open Access" checked={openAccess} onChange={setOpenAccess} />
              <label className="filter-citations-label" htmlFor={`${id}-citations`}>Citations ≥</label><input id={`${id}-citations`} className="filter-citations" type="number" min="1" step="1" placeholder="Min 1" value={citations} onChange={event => setCitations(event.target.value)} />
            </div>
            <section className={`filter-section ${fieldsOpen ? "is-expanded" : ""}`}>
              <button type="button" className="filter-section-heading" aria-expanded={fieldsOpen} aria-controls={`${id}-fields`} onClick={() => setFieldsOpen(!fieldsOpen)}>Field of Study<FigmaAsset name="filter-chevron" className="filter-section-chevron" /></button>
              {fieldsOpen && <div id={`${id}-fields`} className="filter-field-groups">{studyFields.map(group => <fieldset key={group.label}><legend>{group.label}</legend>{group.options.map(option => <Checkbox key={option} label={option} checked={fields.includes(option)} onChange={() => setFields(toggleSelection(fields, option))} />)}</fieldset>)}</div>}
            </section>
            <section className={`filter-section ${journalOpen ? "is-expanded" : ""}`}>
              <button type="button" className="filter-section-heading" aria-expanded={journalOpen} aria-controls={`${id}-journal`} onClick={() => setJournalOpen(!journalOpen)}>Journal Rating - SJR<span className="filter-journal-icon"><FigmaAsset name="filter-journal-chevron" className="filter-section-chevron" /></span></button>
              {journalOpen && <div id={`${id}-journal`} className="filter-journal-options">{["Q1", "Q2", "Q3", "Q4"].map(option => <Checkbox key={option} label={option} checked={quartiles.includes(option)} onChange={() => setQuartiles(toggleSelection(quartiles, option))} />)}</div>}
            </section>
          </div>
        </div>
      </div>
      <div ref={track} className="filter-scroll-track" role="scrollbar" aria-label="Scroll filters" aria-controls={`${id}-scroll`} aria-orientation="vertical" aria-valuemin={0} aria-valuemax={scroll.max} aria-valuenow={scroll.position} aria-disabled={!scroll.max} tabIndex={scroll.max ? 0 : -1}
        onKeyDown={event => {
          const area = viewport.current!;
          const destinations: Record<string, number> = { ArrowDown: area.scrollTop + 40, ArrowUp: area.scrollTop - 40, PageDown: area.scrollTop + area.clientHeight, PageUp: area.scrollTop - area.clientHeight, Home: 0, End: scroll.max };
          if (event.key in destinations) { event.preventDefault(); area.scrollTop = destinations[event.key]; }
        }} onPointerDown={event => {
          if (!scroll.max) return;
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
          const area = viewport.current!, travel = Math.max(1, event.currentTarget.clientHeight - thumb.current!.clientHeight);
          if (event.target !== thumb.current) area.scrollTop = (event.clientY - event.currentTarget.getBoundingClientRect().top - thumb.current!.clientHeight / 2) / travel * scroll.max;
          drag.current = { pointer: event.pointerId, y: event.clientY, scroll: area.scrollTop };
        }} onPointerMove={event => {
          if (drag.current?.pointer !== event.pointerId) return;
          const travel = Math.max(1, event.currentTarget.clientHeight - thumb.current!.clientHeight);
          viewport.current!.scrollTop = drag.current.scroll + (event.clientY - drag.current.y) / travel * scroll.max;
        }} onPointerUp={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        <div ref={thumb} className="filter-scroll-thumb" />
      </div>
      <footer className="filter-dialog-footer">{error && <p role="alert" className="filter-validation">{error}</p>}<button type="submit" className="primary-button filter-apply">Apply Filters</button></footer>
    </form>
  </dialog>;
}
