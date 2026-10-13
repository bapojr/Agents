'use client';
import {useEffect,useRef,useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faTableCellsLarge,faWandMagicSparkles} from '@fortawesome/free-solid-svg-icons';
import type {Paper} from '../paper-data';
import {ReferencePaywall} from '../reference-paywall';
import {SNAPSHOT_FIELDS,UNKNOWN_USAGE,type Snapshot,type SnapshotUsage,type SnapshotValue} from './model';
import {snapshotService,type SnapshotAccess,type SnapshotService} from './service';
import './snapshot.css';

type State={status:'idle'|'loading'|'ready'|'failed';snapshot?:Snapshot;error?:string};
const initial:State={status:'idle'};
// Decorative, non-research words only. Hidden from assistive technology and copying.
const previewLines=['A structured description will appear here after generation','Source-supported details will be presented in this section','Only information available in this paper will be included','Additional details will appear when supported by the source','The generated content will be specific to this paper'];
const lineCounts=[3,4,2,1,3,5,2];
function Preview({lines,loading}:{lines:number;loading:boolean}){
  return <><span className="sr-only">{loading?'Generating content':'Preview only. Generate a Snapshot to reveal this section.'}</span><div className={`snapshot-preview${loading?' is-loading':''}`} aria-hidden="true">{previewLines.slice(0,lines).map((text,i)=><span key={i} className={`snapshot-preview-line line-${i}`}>{text}</span>)}</div></>;
}
function Value({cell}:{cell:SnapshotValue}){
  return <><p>{cell.value}</p>{cell.status==='supported'&&<details className="snapshot-provenance"><summary>Supporting source{cell.evidence.length>1?'s':''}</summary>{cell.evidence.map(e=><blockquote key={e.id}><p>“{e.text}”</p><span>{e.sourceType==='abstract'?'Abstract':`Full text · Page ${e.page}`}</span></blockquote>)}</details>}</>;
}
export function SnapshotContent({state,usage,onGenerate,onUpgrade,message}:{state:State;usage:SnapshotUsage;onGenerate:()=>void;onUpgrade:()=>void;message:string}){
  const result=state.snapshot,loading=state.status==='loading',exhausted=!usage.unlimited&&usage.remaining===0;
  const refill=usage.refillAt?new Date(usage.refillAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):null;
  return <div className="paper-snapshot" aria-busy={loading}>
    {!result&&<section className="snapshot-usage" aria-labelledby="snapshot-usage-title">
      <h3 id="snapshot-usage-title">{usage.unlimited?'Unlimited Study Snapshots':usage.remaining!==null?`${usage.remaining} Study Snapshot${usage.remaining===1?'':'s'} left`:'Study Snapshot'}</h3>
      <p>{usage.unlimited?'Generate a structured, evidence-backed summary of this paper.':usage.remaining!==null?`You have ${usage.remaining} Study Snapshot${usage.remaining===1?'':'s'} left.`:'Generate a structured summary using this paper’s available source text. Your Snapshot allowance is not available yet.'}{refill&&` ${usage.refillAmount?`You will get ${usage.refillAmount} more on`:'Your allowance refills on'} ${refill}.`}</p>
      <div className="snapshot-actions"><button className="outline-button" onClick={onUpgrade}>Upgrade for unlimited</button><button className="primary-button" onClick={onGenerate} disabled={loading||exhausted}>{loading?'Generating Snapshot…':state.status==='failed'?'Retry Snapshot':'Generate Snapshot'}</button></div>
      <p className="snapshot-context">{exhausted?'Your Snapshot allowance has been used. Upgrade or wait for your next refill.':message||'The blurred content below is a preview of the structure, not research findings.'}</p>
    </section>}
    <div role="status" className="snapshot-status">{loading?'Generating Study Snapshot…':result?'Study Snapshot ready.':''}</div>
    {state.error&&<p role="alert" className="snapshot-error">{state.error}</p>}
    {result&&<p className="snapshot-context">{result.sourceType==='abstract'?'Based on the available abstract only. Full text was not analysed.':'Based on the available full-text passages.'} Missing information is shown as “Not reported”.</p>}
    <section className="snapshot-card" aria-labelledby="study-snapshot-title"><h3 id="study-snapshot-title"><FontAwesomeIcon icon={faTableCellsLarge} aria-hidden="true"/>Study Snapshot</h3>
      <dl className="snapshot-fields">{SNAPSHOT_FIELDS.map((field,i)=><div className="snapshot-row" key={field.id}><dt>{field.label}</dt><dd>{result?<Value cell={result.cells[field.id]}/>:<Preview lines={lineCounts[i]} loading={loading}/>}</dd></div>)}</dl>
    </section>
    <section className="snapshot-card" aria-labelledby="snapshot-summary-title"><h3 id="snapshot-summary-title"><FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true"/>AI Summary</h3><div className="snapshot-summary">{result?<Value cell={result.cells['ai-summary']}/>:<Preview lines={4} loading={loading}/>}</div></section>
  </div>;
}
export function PaperSnapshot({paper,service=snapshotService}:{paper:Paper;service?:SnapshotService}){
  const [state,setState]=useState<State>(()=>{const saved=service.cached(paper);return saved?{status:'ready',snapshot:saved}:initial;});
  const [access,setAccess]=useState<SnapshotAccess>({available:false,message:'Checking Snapshot availability…',usage:UNKNOWN_USAGE});
  const [upgrade,setUpgrade]=useState(false);
  const mounted=useRef(false);
  useEffect(()=>{
    mounted.current=true;let active=true;
    const saved=service.cached(paper),pending=service.inFlight(paper);
    if(saved)setState({status:'ready',snapshot:saved});
    else if(pending){setState({status:'loading'});void pending.then(snapshot=>{if(active)setState({status:'ready',snapshot});}).catch(e=>{if(active)setState({status:'failed',error:e.message});});}
    void service.access().then(value=>{if(active)setAccess(value);}).catch(e=>{if(active)setAccess({available:false,message:e.message,usage:UNKNOWN_USAGE});});
    return()=>{active=false;mounted.current=false;};
  },[paper,service]);
  async function generate(){
    if(state.status==='loading'||state.snapshot)return;
    setState({status:'loading'});
    try{
      const capability=await service.access();if(mounted.current)setAccess(capability);
      if(!capability.available)throw new Error(capability.message);
      if(!capability.usage.unlimited&&capability.usage.remaining===0)throw new Error('Your Snapshot allowance has been used.');
      const snapshot=await service.generate(paper);
      if(mounted.current)setState({status:'ready',snapshot});
    }catch(e){if(mounted.current)setState({status:'failed',error:e instanceof Error?e.message:'Snapshot generation failed. Please retry.'});}
  }
  return <><SnapshotContent state={state} usage={access.usage} message={access.message} onGenerate={()=>void generate()} onUpgrade={()=>setUpgrade(true)}/>{upgrade&&<ReferencePaywall reason="snapshot" onClose={()=>setUpgrade(false)}/>}</>;
}
