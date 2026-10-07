'use client';
import {FigmaAsset,Icon,icons} from './figma-assets';
import {abstractExcerpt,type Paper} from './paper-data';
import {SourceCitation,type ReferenceActions} from './reference-components';
import type {CitationPreferences} from './thread-state';
export function SearchAnswer({query,papers,loading,error,retry,preferences,actions,onReferences,onFilter,onFollowup,showFollowups,onDismiss}:{query:string;papers:Paper[];loading:boolean;error:string;retry:()=>void;preferences:CitationPreferences;actions:ReferenceActions;onReferences:()=>void;onFilter:()=>void;onFollowup:(q:string)=>void;showFollowups:boolean;onDismiss:()=>void}) {
  const sources=papers.slice(0,5);
  return <article className="research-answer"><div className="answer-title-row"><span className="answer-brand"><Icon name={icons.research}/>Paperpal</span><span className="rw-muted">Search papers</span></div>
    <h1>Papers for your research</h1>
    <p className="search-data-note">Results from Crossref. Abstract excerpts are publisher-provided; AI synthesis and enhanced extraction are not connected yet.</p>
    {loading&&!papers.length?<div className="answer-loading" role="status" aria-label="Searching papers"><span/><span/><span/></div>:error&&!papers.length?<div className="rw-empty" role="alert"><h3>We couldn’t load your papers</h3><p>{error}</p><button className="outline-button" onClick={retry}>Retry search</button></div>:!papers.length?<div className="rw-empty"><h3>No papers found</h3><p>Try a more specific research topic or a different query.</p></div>:<>
    <p className="answer-intro">{papers.length} references loaded for “{query}”. Explore the source records below and compare them in References.</p>
    {sources.map((p,i)=><section className="answer-section" key={p.id}><h2>{p.title}</h2><p>{p.abstract?<><span className="rw-eyebrow">Abstract excerpt</span><br/>{abstractExcerpt(p)}</>:<>The source provides a bibliographic record{p.journal?` in ${p.journal}`:''}{p.year?` (${p.year})`:''}. An abstract is not available for this paper.</>} <SourceCitation paper={p} number={i+1} label={preferences.citationFormat==='numeric'?`[${i+1}]`:[p.shortAuthor,p.year].filter(Boolean).join(', ')||`Source ${i+1}`} actions={actions}/></p></section>)}
    <div className="answer-actions"><button className="rw-action" onClick={onReferences}>References ({papers.length})</button><button className="rw-action" onClick={onFilter}><Icon name="filter-sliders"/>Filters</button></div>
    {showFollowups&&<section className="followup-suggestions" aria-labelledby="followup-heading"><div className="followup-heading"><h2 id="followup-heading">What would you like to do next?</h2><button className="followup-dismiss" aria-label="Dismiss follow-up suggestions" onClick={onDismiss}><FigmaAsset name="followup-xmark"/></button></div><div className="followup-options">{['Compare the available abstracts','Explore the methods in these papers','What limitations are reported?'].map(q=><button className="followup-option" key={q} onClick={()=>onFollowup(q)}><span className="followup-icon-tile"><span className="followup-sparkle" style={{maskImage:`url(${process.env.NEXT_PUBLIC_BASE_PATH||''}/figma/followup-sparkles.svg)`}}/></span><span className="followup-label">{q}</span><FigmaAsset name="followup-chevron-left" className="followup-chevron"/></button>)}</div></section>}
    </>}
  </article>;
}
