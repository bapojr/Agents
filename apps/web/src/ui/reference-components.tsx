'use client';
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {FigmaAsset} from './figma-assets';
import {Popover} from './popover';
import type {Paper} from './paper-data';
import {DEFAULT_COLUMN_IDS,FREE_ENTITLEMENTS,REFERENCE_COLUMNS,addReferenceColumn,columnValue,referencePartition,type Entitlements,type ReferenceColumn} from './reference-model';
export type ReferenceActions = {saved:string[];onSave:(id:string)=>void;onOpen:(p:Paper)=>void;onEvidence?:(p:Paper,e:import("./paper-data").Evidence)=>void;onCopy:(p:Paper)=>void;onNotice:(s:string)=>void};
export function PaperMetadata({paper:p,prefix='ref'}:{paper:Paper;prefix?:string}) {
  const [allAuthors,setAllAuthors]=useState(false);
  return <div className="source-metadata">
    <div className="source-meta-line">{p.year && <strong>{p.year}</strong>}{p.type && <span>{p.type}</span>}{p.authors.length>0 && <button className="source-authors" title={p.authors.join(', ')} onClick={()=>setAllAuthors(!allAuthors)}>{allAuthors?p.authors.join(', '):p.authors.slice(0,2).join(', ')}{!allAuthors&&p.authors.length>2?`, and ${p.authors.length-2} more`:''}</button>}</div>
    {p.journal&&<div className="source-journal"><FigmaAsset name={`${prefix}-imgBookOpenLines`}/><em>{p.journal}</em></div>}
    <div className="source-meta-line source-metrics">{p.citationCount!==undefined&&<span>{p.citationCount.toLocaleString()} citations</span>}{p.quartile&&<span className="source-quartile">{p.quartile}</span>}{p.openAccess===true&&<span className="source-oa"><FigmaAsset name={`${prefix}-imgOpenAccessLogoPLoSWhiteLogo`}/>Open access</span>}</div>
  </div>;
}
export function PaperActions({paper,actions,prefix='ref',hover=false}:{paper:Paper;actions:ReferenceActions;prefix?:string;hover?:boolean}) {
  const [more,setMore]=useState(false);
  return <div className="source-actions">
    <button title="Cite" aria-label={`Cite ${paper.title}`} onClick={()=>actions.onCopy(paper)}><FigmaAsset name={`${prefix}-imgQuoteRight`}/></button>
    <button title="Save to library" aria-label={`Save ${paper.title}`} aria-pressed={actions.saved.includes(paper.id)} onClick={()=>actions.onSave(paper.id)}><FigmaAsset name={`${prefix}-imgBookmark`}/></button>
    {!hover&&<><button title="Explore source" aria-label={`Explore ${paper.title}`} onClick={()=>actions.onOpen(paper)}><FigmaAsset name="ref-imgSparkle"/></button><button title="Edit reference" aria-label={`Edit ${paper.title}`} onClick={()=>actions.onNotice('Reference editing is not connected. Source metadata remains unchanged.')}><FigmaAsset name="ref-imgPencil"/></button></>}
    <Popover label={`More actions for ${paper.title}`} open={more} onOpenChange={setMore} trigger={<FigmaAsset name={`${prefix}-imgEllipsisVertical`}/>} className="source-more">
      <button role="menuitem" className="menu-option compact" onClick={()=>{actions.onOpen(paper);setMore(false);}}>View paper details</button>
      <a role="menuitem" className="menu-option compact" href={paper.url} target="_blank" rel="noreferrer" onClick={()=>setMore(false)}>Open original source</a>
    </Popover>
    {paper.verified===true&&<span className="source-verified"><FigmaAsset name={`${prefix}-imgCircleCheck`}/>Verified</span>}
  </div>;
}
export function StandardReference({paper,number,selected,onSelect,actions}:{paper:Paper;number:number;selected:boolean;onSelect:()=>void;actions:ReferenceActions}) {
  return <article className="standard-reference" data-paper-id={paper.id} aria-label={`Reference ${number}`}>
    <div className="source-title-row"><input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${paper.title}`}/><button className="source-title" onClick={()=>actions.onOpen(paper)}><span className="sr-only">{number}. </span>{paper.title}</button></div>
    <PaperMetadata paper={paper}/>
    {paper.provider&&<a className="source-provider" href={paper.sources?.find(s=>s.provider===paper.provider)?.recordUrl || paper.url} target="_blank" rel="noreferrer">{paper.provider}<FigmaAsset name="ref-imgArrowUpRightFromSquare"/></a>}
    <PaperActions paper={paper} actions={actions}/>
  </article>;
}
export function SourceCitation({paper,number,label,actions}:{paper:Paper;number:number;label:string;actions:ReferenceActions}) {
  const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(false);
  const [position,setPosition]=useState({left:0,top:0});
  const trigger=useRef<HTMLButtonElement>(null),card=useRef<HTMLDivElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),id=useId();
  const restoringFocus=useRef(false);
  const stay=()=>{clearTimeout(timer.current);setOpen(true);};
  const leave=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{
    if(!card.current?.contains(document.activeElement)&&document.activeElement!==trigger.current)setOpen(false);
  },280);};
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useLayoutEffect(()=>{
    if(!open)return;
    const place=()=>{if(!trigger.current||!card.current)return;const a=trigger.current.getBoundingClientRect(),b=card.current.getBoundingClientRect();const gap=parseFloat(getComputedStyle(card.current).getPropertyValue('--pp-s8'));
      setPosition({left:Math.max(gap,Math.min(a.left,innerWidth-b.width-gap)),top:Math.max(gap,a.bottom+gap+b.height<=innerHeight?a.bottom+gap:a.top-b.height-gap)});};
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    const observer=new ResizeObserver(place);if(card.current)observer.observe(card.current);
    return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const close=(e:PointerEvent)=>{if(!card.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();restoringFocus.current=true;setOpen(false);trigger.current?.focus();requestAnimationFrame(()=>{restoringFocus.current=false;});}};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape,true);};
  },[open]);
  return <span className="citation-wrap"><button ref={trigger} className="citation-chip" aria-label={`Preview citation ${number}: ${paper.title}`} aria-expanded={open} aria-controls={open?id:undefined} onPointerEnter={stay} onPointerLeave={leave} onFocus={()=>{if(!restoringFocus.current)stay();}} onBlur={leave} onClick={stay} onKeyDown={e=>{if(e.key==='ArrowDown'&&open){e.preventDefault();card.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}>{label}</button>
    {open&&createPortal(<div ref={card} id={id} role="dialog" aria-label={`Source ${number}`} className="source-hover" style={position} onPointerEnter={stay} onPointerLeave={leave} onFocus={stay} onBlur={leave}>
      <button className="source-title" onClick={()=>{actions.onOpen(paper);setOpen(false);}}>{paper.title}</button>
      {paper.provider&&<a className="source-provider" href={paper.sources?.find(s=>s.provider===paper.provider)?.recordUrl || paper.url} target="_blank" rel="noreferrer">{paper.provider}<FigmaAsset name="source-imgArrowUpRightFromSquare"/></a>}
      <div className="source-abstract"><strong>ABSTRACT</strong><p className={expanded?'':'is-clamped'}>{paper.abstract||'Abstract not available from this source.'}</p>{paper.abstract&&paper.abstract.length>240&&<button onClick={()=>setExpanded(!expanded)}>{expanded?'Read less':'Read more'}</button>}</div>
      <PaperMetadata paper={paper} prefix="source"/><PaperActions paper={paper} actions={actions} prefix="source" hover/>
    </div>,document.body)}
  </span>;
}
export function ColumnManager({columns,visible,onColumns,onVisible}:{columns:ReferenceColumn[];visible:string[];onColumns:(c:ReferenceColumn[])=>void;onVisible:(c:string[])=>void}) {
  const [open,setOpen]=useState(false),[add,setAdd]=useState(false),[name,setName]=useState(''),[question,setQuestion]=useState(''),[error,setError]=useState('');
  const manager=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!open)return;
    const fit=()=>{const panel=manager.current?.querySelector<HTMLElement>('.popover-panel');if(!panel)return;
      const gap=parseFloat(getComputedStyle(panel).getPropertyValue('--pp-s8'));
      panel.style.maxHeight=`${Math.max(0,innerHeight-panel.getBoundingClientRect().top-gap)}px`;
    };
    fit();window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);
  },[open,add]);
  return <div ref={manager}><Popover menu={false} className="column-manager secondary-action" label="Manage columns" open={open} onOpenChange={setOpen} trigger={<><FigmaAsset name="tablebar-imgIcon2"/>Manage columns</>}>
    <div className="column-manager-heading"><FigmaAsset name="columns-imgIcon"/><strong>Manage Columns</strong><button aria-label="Close column manager" onClick={()=>setOpen(false)}><FigmaAsset name="columns-imgIcon1"/></button></div>
    <div className="column-manager-body"><div className="column-group"><p>Create custom column</p><button className="outline-button add-column" onClick={()=>{setAdd(!add);setError('');}}><FigmaAsset name="columns-imgIcon2"/>Add Column</button>
      {add&&<form className="column-form" onSubmit={e=>{e.preventDefault();try{const next=addReferenceColumn(columns,name,question);onColumns(next);onVisible([...visible,next.at(-1)!.id]);setName('');setQuestion('');setAdd(false);}catch(e){setError((e as Error).message);}}}>
        <label><span>Column Name <span className="required-marker" aria-hidden="true">*</span></span><input autoFocus aria-label="Column Name" placeholder="Eg. Future Scope" value={name} maxLength={80} onChange={e=>setName(e.target.value)} required/></label><label>Instructions (Optional)<textarea placeholder="Give context for what this column represents, helps the system generate relevant content" value={question} maxLength={500} onChange={e=>setQuestion(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<div className="column-form-actions"><button className="outline-button" type="button" onClick={()=>{setAdd(false);setName('');setQuestion('');setError('');}}>Cancel</button><button className="primary-button" type="submit" disabled={!name.trim()}>Create</button></div>
      </form>}
    </div>{(['suggested','saved','default'] as const).map(group=><div className="column-group" key={group}><p>{group==='suggested'?'Suggested Columns':group==='saved'?'Saved Columns':'Default Columns'}</p>{!columns.some(c=>c.group===group)&&<span className="rw-muted">No saved columns</span>}{columns.filter(c=>c.group===group).map(c=><div className="column-toggle" key={c.id}><button role="switch" aria-label={`Show ${c.label} column`} aria-checked={visible.includes(c.id)} onClick={()=>onVisible(visible.includes(c.id)?visible.filter(id=>id!==c.id):[...visible,c.id])}><span/></button><span>{c.label}</span>{group==='saved'&&<button className="column-delete" aria-label={`Delete ${c.label} column`} onClick={()=>{onColumns(columns.filter(x=>x.id!==c.id));onVisible(visible.filter(id=>id!==c.id));}}><FigmaAsset name="columns-imgIcon1"/></button>}</div>)}</div>)}</div>
  </Popover></div>;
}
export function TableReferences({items,allItems,selected,onSelect,actions,columns,visible,onUpgrade,entitlements=FREE_ENTITLEMENTS}:{items:Paper[];allItems:Paper[];selected:string[];onSelect:(id:string)=>void;actions:ReferenceActions;columns:ReferenceColumn[];visible:string[];onUpgrade:()=>void;entitlements?:Entitlements}) {
  const partition=referencePartition(items,entitlements),shown=columns.filter(c=>visible.includes(c.id));
  const ranks=new Map(allItems.map((p,i)=>[p.id,i+1]));
  return <><div className="reference-table-wrap" tabIndex={0} role="region" aria-label="Scrollable reference table"><table className="reference-table figma-reference-table"><thead><tr><th scope="col" className="ref-check"><span className="sr-only">Select</span></th><th scope="col">Source ({items.length})</th>{shown.map(c=><th scope="col" key={c.id}>{c.id==='dimension'?'Research dimension':c.label}</th>)}</tr></thead><tbody>{partition.table.map(p=><tr key={p.id} data-paper-id={p.id} aria-label={`Reference ${ranks.get(p.id)!}`}><td><input type="checkbox" checked={selected.includes(p.id)} aria-label={`Select ${p.title}`} onChange={()=>onSelect(p.id)}/></td><td className="table-source"><button className="source-title" onClick={()=>actions.onOpen(p)}>{p.title}</button>{p.authors.length>0&&<p className="table-authors" title={p.authors.join(', ')}>{p.authors.slice(0,2).join(', ')}{p.authors.length>2?`, and ${p.authors.length-2} more`:''}</p>}<p className="table-meta">{[p.journal,p.year,p.citationCount!==undefined?`${p.citationCount} citations`:null].filter(x=>x!==undefined&&x!==null&&x!=='').join(' · ')}</p><div className="table-badges">{p.doi&&<a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer"><FigmaAsset name="table-imgIcon"/>DOI</a>}{p.pdf&&<a href={p.pdf} target="_blank" rel="noreferrer"><FigmaAsset name="table-imgIcon1"/>Full text available</a>}</div><div className="table-source-actions"><button onClick={()=>actions.onSave(p.id)} aria-pressed={actions.saved.includes(p.id)}><FigmaAsset name="table-imgIcon2"/>{actions.saved.includes(p.id)?'Saved':'Add to library'}</button><button onClick={()=>actions.onCopy(p)}><FigmaAsset name="table-imgIcon3"/>Cite</button></div></td>{shown.map(c=>{const value=columnValue(p,c);return <td key={c.id} className={value.text==='Not extracted'?'not-extracted':''}>{value.text}{value.evidence&&<details><summary>Source evidence</summary><q>{value.evidence}</q>{p.evidence.filter(e=>p.extractions?.[c.id]?.evidenceIds?.includes(e.id)).map(e=><button key={e.id} className="table-evidence" onClick={()=>actions.onEvidence?.(p,e)}>View linked evidence{e.page?` · Page ${e.page}`:" · Abstract"}</button>)}<a href={value.url} target="_blank" rel="noreferrer">Open source</a></details>}</td>;})}</tr>)}</tbody></table></div>
    {partition.showUpgrade&&<section className="reference-limit-nudge" aria-label="Tabular reference limit"><div><strong>Unlock tabular insights for more papers</strong><p>Your first {entitlements.tabularReferenceLimit} references are in the table. Continue exploring the remaining papers below.</p></div><button className="outline-button" onClick={onUpgrade}>Upgrade</button></section>}
    {partition.standard.length>0&&<div className="standard-reference-list" aria-label="More references">{partition.standard.map(p=><StandardReference key={p.id} paper={p} number={ranks.get(p.id)!} selected={selected.includes(p.id)} onSelect={()=>onSelect(p.id)} actions={actions}/>)}</div>}
  </>;
}
export {REFERENCE_COLUMNS,DEFAULT_COLUMN_IDS};
