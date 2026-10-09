'use client';
import {useEffect,useRef,useState} from 'react';
import type {Evidence,Paper} from '../paper-data';
import {loadDocument,documentUrl,documentCredentials,type SourceDocument} from './client';
import {SelectionDropdown} from '../selection-dropdown';
function PageImage({document,page,evidence}:{document:SourceDocument;page:number;evidence?:Evidence}){
  const figure=useRef<HTMLElement>(null);
  const reveal=()=>{if(evidence?.page===page&&evidence.documentId===document.id)figure.current?.querySelector('.pdf-highlight')?.scrollIntoView({block:'center'});};
  const [url,setUrl]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{if(url)requestAnimationFrame(reveal);},[evidence,url]);
  useEffect(()=>{let active=true,objectUrl='';setError('');setUrl('');const abort=new AbortController();
    void fetch(documentUrl(`documents/${document.workId}/pages/${page}?version=${document.id}`),{credentials:documentCredentials,signal:abort.signal}).then(async r=>{if(!r.ok||!r.headers.get('content-type')?.startsWith('image/png'))throw new Error('This page could not load.');const blob=await r.blob();if(active){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(e=>{if(active&&!abort.signal.aborted)setError(e.message);});
    return()=>{active=false;abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[document.workId,document.id,page,retry]);
  return <figure ref={figure} className="pdf-page" data-pdf-page={page}>{error?<div className="rw-empty" role="alert"><p>{error}</p><button className="outline-button" onClick={()=>setRetry(v=>v+1)}>Retry page</button></div>:!url?<div className="rw-empty" role="status">Loading PDF page…</div>:<img src={url} width={document.pages[page-1]?.width} height={document.pages[page-1]?.height} onLoad={reveal} alt={`Page ${page} of ${document.title}`} onError={()=>setError('This PDF page could not be displayed.')}/>} {url&&evidence?.documentId===document.id&&evidence.page===page&&evidence.rects?.map(([x,y,w,h],i)=><span key={i} aria-hidden="true" className="pdf-highlight" style={{left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`}}/>)}<figcaption>Page {page} of {document.pages.length}</figcaption></figure>;
}
export function LiveDocument({paper,evidence}:{paper:Paper;evidence?:Evidence}){
  const [document,setDocument]=useState<SourceDocument>(),[error,setError]=useState(''),[retry,setRetry]=useState(0),[page,setPage]=useState(1),[zoom,setZoom]=useState(100);
  useEffect(()=>{let active=true;setDocument(undefined);setError('');setPage(1);void loadDocument(paper,retry>0).then(d=>{if(active)setDocument(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[paper.id,retry]);
  useEffect(()=>{if(evidence?.page&&document&&evidence.documentId===document.id)setPage(evidence.page);},[evidence,document]);
  const external=<a className="outline-button" href={document?.sourceUrl||paper.pdf||paper.url} target="_blank" rel="noreferrer">{document?.sourceUrl||paper.pdf?'Open source PDF ↗':'Open source record ↗'}</a>;
  if(error)return <div className="rw-empty" role="alert"><h3>PDF could not load</h3><p>{error}</p><button className="outline-button" onClick={()=>setRetry(v=>v+1)}>Retry PDF</button>{external}</div>;
  if(!document)return <div className="rw-empty" role="status">Loading the source document…</div>;
  if(document.pdfStatus!=='available')return <div className="rw-empty"><h3>{document.pdfStatus==='failed'?'PDF could not load':'Full text unavailable'}</h3><p>{document.message}</p>{document.sourceType==='abstract'&&<p>Analysis can use the source abstract only.</p>}{document.pdfStatus==='failed'&&<button className="outline-button" onClick={()=>setRetry(v=>v+1)}>Retry PDF</button>}{external}</div>;
  return <><div className="pdf-controls live-pdf-controls"><SelectionDropdown label="PDF page" value={String(page)} onChange={v=>setPage(Number(v))} options={document.pages.map(p=>({value:String(p.number),label:`${p.number} / ${document.pages.length}`}))}/><SelectionDropdown label="PDF zoom" value={String(zoom)} onChange={v=>setZoom(Number(v))} options={[100,125,150].map(n=>({value:String(n),label:`${n}%`}))}/>{external}</div><p className="pdf-attribution">Real source PDF · {document.message||'Highlights link to exact extracted source text.'}</p><div className="pdf-pages" style={{width:`${zoom}%`}}><PageImage document={document} page={page} evidence={evidence}/></div></>;
}
