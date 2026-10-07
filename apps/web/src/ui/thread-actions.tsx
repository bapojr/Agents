"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faBookmark, faChevronRight, faCopy, faFolder, faFolderPlus, faLink, faSliders } from "@fortawesome/free-solid-svg-icons";
import { Popover } from "./popover";
import { UpgradeButton } from "./upgrade-button";
import { emptyLibrary, exportFormats, readLibrary, saveThread, threadLink, type CitationPreferences, type ResearchSession, type ThreadLibrary } from "./thread-state";

const libraryKey = "agents-thread-library-v1";
export function ThreadActions({ session, preferences, onPreferences, referencesOpen, onReferences, onCopy, onNotice, onUpgrade }: {
  session: ResearchSession; preferences: CitationPreferences; onPreferences: (p: CitationPreferences) => void;
  onUpgrade?: () => void; referencesOpen: boolean; onReferences: () => void; onCopy: (text: string) => void; onNotice: (message: string) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [formatsOpen, setFormatsOpen] = useState(false);
  const [library, setLibrary] = useState<ThreadLibrary>(emptyLibrary);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const formatList = useRef<HTMLDivElement>(null);
  const formatTrigger = useRef<HTMLButtonElement>(null);
  const collectionInput = useRef<HTMLInputElement>(null);
  const saved = library.threads.some(s => s.id === session.id);
  useEffect(() => { try { setLibrary(readLibrary(JSON.parse(localStorage.getItem(libraryKey) || "null"))); } catch { /* Start an empty session library if storage is unavailable. */ } setLoaded(true); }, []);
  useEffect(() => { if (!loaded || !saved) return; setLibrary(previous => saveThread(previous, session, true)); }, [session, loaded, saved]);
  useEffect(() => { if (!loaded) return; try { localStorage.setItem(libraryKey, JSON.stringify(library)); } catch { onNotice("Saved for this session. Browser storage is unavailable."); } }, [library, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (formatsOpen) formatList.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(); }, [formatsOpen]);
  useEffect(() => { if (creating) collectionInput.current?.focus(); }, [creating]);
  const close = () => { setMenu(null); setCreating(false); setError(""); };
  const changeMenu = (which: string, open: boolean) => { setMenu(open ? which : null); setFormatsOpen(false); setCreating(false); setError(""); };
  const addCollection = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Enter a collection name."); return; }
    if (library.collections.some(c => c.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) { setError("A collection with that name already exists."); return; }
    setLibrary(previous => { const next = saveThread(previous, session, true); return { ...next, collections: [...next.collections, { id: crypto.randomUUID(), name: trimmed, threadIds: [session.id] }] }; });
    setCreating(false); setName(""); setSearch(""); setError(""); onNotice(`Saved to ${trimmed}.`);
  };
  const count = (n: number) => n ? `${n} ${n === 1 ? "item" : "items"}` : "No items yet";
  return <div className="thread-actions" aria-label="Conversation actions">
    <Popover label="Save thread to library" className={`thread-popover thread-icon-menu ${saved ? "is-saved" : ""}`} open={menu === "library"} onOpenChange={v => changeMenu("library", v)} menu={false} trigger={<FontAwesomeIcon icon={faBookmark} className={saved ? "" : "outline-glyph"} aria-hidden="true" />}>
      <label className="thread-library-row"><FontAwesomeIcon icon={faBookmark} aria-hidden="true" /><span><strong>My Library</strong><small>{count(library.threads.length)}</small></span><input type="checkbox" aria-label="Save thread in My Library" checked={saved} onChange={e => setLibrary(previous => saveThread(previous, session, e.target.checked))} /></label>
      <span className="menu-heading">Add to Collection</span>
      <input className="thread-library-search" aria-label="Search your Library" placeholder="Search your Library..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="thread-collection-list">{library.collections.filter(c => c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(c => <label className="thread-library-row" key={c.id}><FontAwesomeIcon icon={faFolder} aria-hidden="true" /><span><strong>{c.name}</strong><small>{count(c.threadIds.length)}</small></span><input type="checkbox" aria-label={`Save thread in ${c.name}`} checked={c.threadIds.includes(session.id)} onChange={e => { const checked = e.target.checked; setLibrary(previous => { const next = checked ? saveThread(previous, session, true) : previous; return { ...next, collections: next.collections.map(item => item.id !== c.id ? item : { ...item, threadIds: checked ? [...new Set([...item.threadIds, session.id])] : item.threadIds.filter(id => id !== session.id) }) }; }); }} /></label>)}{!library.collections.some(c => c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p className="rw-muted thread-empty">No matching collections.</p>}</div>
      <div className="thread-menu-footer">{creating ? <form onSubmit={e => { e.preventDefault(); addCollection(); }}><label htmlFor="collection-name" className="sr-only">Collection name</label><input ref={collectionInput} id="collection-name" placeholder="Collection name" maxLength={80} value={name} aria-invalid={!!error} aria-describedby={error ? "collection-error" : undefined} onChange={e => { setName(e.target.value); setError(""); }} />{error && <p id="collection-error" role="alert">{error}</p>}<div className="rw-actions"><button className="outline-button" type="button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-button" type="submit">Create & save</button></div></form> : <button className="outline-button" onClick={() => { setName(search); setCreating(true); }}><FontAwesomeIcon icon={faFolderPlus} aria-hidden="true" />New Collection</button>}</div>
      <p className="rw-muted thread-local-note">Saved on this browser</p>
    </Popover>
    <Popover label="Citation settings" className="thread-popover thread-icon-menu" open={menu === "settings"} onOpenChange={v => changeMenu("settings", v)} trigger={<FontAwesomeIcon icon={faSliders} aria-hidden="true" />}>
      {formatsOpen ? <div ref={formatList} onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setFormatsOpen(false); requestAnimationFrame(() => formatTrigger.current?.focus()); } }}><button role="menuitem" className="menu-option thread-back" onClick={() => { setFormatsOpen(false); requestAnimationFrame(() => formatTrigger.current?.focus()); }}><FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />Default export format</button>{exportFormats.map(format => <button key={format} role="menuitemradio" aria-checked={preferences.exportFormat === format} className="menu-option thread-choice" onClick={() => { onPreferences({ ...preferences, exportFormat: format }); }}><span>{format}</span><span className="thread-radio" aria-hidden="true" /></button>)}</div> : <><span className="menu-heading">Citation format</span>{([['author-year', 'Author and year'], ['numeric', 'Numeric']] as const).map(([value, label]) => <button key={value} role="menuitemradio" aria-checked={preferences.citationFormat === value} className="menu-option thread-choice" onClick={() => onPreferences({ ...preferences, citationFormat: value })}><span>{label}</span><span className="thread-radio" aria-hidden="true" /></button>)}<div className="thread-menu-footer"><button ref={formatTrigger} role="menuitem" aria-haspopup="menu" className="menu-option thread-format-trigger" onClick={() => setFormatsOpen(true)} onKeyDown={e => { if (e.key === "ArrowRight") { e.preventDefault(); setFormatsOpen(true); } }}><span>Default export format</span><small>{preferences.exportFormat}</small><FontAwesomeIcon icon={faChevronRight} aria-hidden="true" /></button></div></>}
    </Popover>
    <button id="show-references" aria-label="References" className="rw-action thread-references" onClick={onReferences} aria-expanded={referencesOpen}><FontAwesomeIcon icon={faCopy} className="outline-glyph" aria-hidden="true" /><span>References</span></button>
    <Popover label="Share thread" className="thread-popover secondary-action thread-share" open={menu === "share"} onOpenChange={v => changeMenu("share", v)} trigger={<><FontAwesomeIcon icon={faLink} aria-hidden="true" /><span>Share</span></>}>
      <span className="menu-heading">Share thread</span>
      <button role="menuitem" className="menu-option thread-menu-action" onClick={() => { const url = new URL("https://x.com/intent/post"); url.searchParams.set("url", threadLink(window.location.href, session)); window.open(url.toString(), "_blank", "noopener,noreferrer"); close(); }}><span className="thread-x" aria-hidden="true">𝕏</span>Share to X</button>
      <button role="menuitem" className="menu-option thread-menu-action" onClick={() => { onCopy(threadLink(window.location.href, session)); close(); }}><FontAwesomeIcon icon={faLink} aria-hidden="true" />Copy thread link</button>
    </Popover>
    <UpgradeButton onClick={onUpgrade || (() => onNotice("Prime upgrades aren’t available in this preview yet."))} />
  </div>;
}
