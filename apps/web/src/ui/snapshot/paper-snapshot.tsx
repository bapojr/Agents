'use client';
import {useEffect,useRef,useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faTableCellsLarge,faWandMagicSparkles} from '@fortawesome/free-solid-svg-icons';
import type {Paper} from '../paper-data';
import {UpgradeButton} from '../upgrade-button';
import {SAMPLE_SNAPSHOT,SNAPSHOT_PREVIEW_COPY} from './sample';
import {ReferencePaywall} from '../reference-paywall';
import {SNAPSHOT_FIELDS,UNKNOWN_USAGE,type Snapshot,type SnapshotUsage,type SnapshotValue} from './model';
import {snapshotService,type SnapshotAccess,type SnapshotService} from './service';
import './snapshot.css';

type State={status:'idle'|'loading'|'ready'|'failed';snapshot?:Snapshot;sample?:boolean;error?:string};
const initial:State={status:'idle'};
// Kept separately from real extraction/cache state and reset on a new app load.
const samplePapers=new Set<string>();
function Preview({field,loading}:{field:string;loading:boolean}){
  return <><span className="sr-only">{loading?'Generating content':'Preview only. Generate a Snapshot to reveal this section.'}</span><p className={`snapshot-preview${loading?' is-loading':''}`} aria-hidden="true">{SNAPSHOT_PREVIEW_COPY[field]}</p></>;
}
function Value({cell}:{cell:SnapshotValue}){
  return <><p>{cell.value}</p>{cell.status==='supported'&&<details className="snapshot-provenance"><summary>Supporting source{cell.evidence.length>1?'s':''}</summary>{cell.evidence.map(e=><blockquote key={e.id}><p>“{e.text}”</p><span>{e.sourceType==='abstract'?'Abstract':`Full text · Page ${e.page}`}</span></blockquote>)}</details>}</>;
}
export function SnapshotContent({state,usage,onGenerate,onUpgrade,message,previewAvailable=false}:{state:State;usage:SnapshotUsage;onGenerate:()=>void;onUpgrade:()=>void;message:string;previewAvailable?:boolean}){
  const result=state.snapshot,filled=!!result||state.sample,loading=state.status==='loading',exhausted=!usage.unlimited&&usage.remaining===0;
  const refill=usage.refillAt?new Date(usage.refillAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):null;
  return <div className="paper-snapshot" aria-busy={loading}>
    {!filled&&<section className="snapshot-usage" aria-labelledby="snapshot-usage-title">
      <h3 id="snapshot-usage-title">{usage.unlimited?'Unlimited Study Snapshots':usage.remaining!==null?`${usage.remaining} Study Snapshot${usage.remaining===1?'':'s'} left`:'Study Snapshot'}</h3>
      <p>{usage.unlimited?'Generate a structured, evidence-backed summary of this paper.':usage.remaining!==null?`You have ${usage.remaining} Study Snapshot${usage.remaining===1?'':'s'} left.`:previewAvailable?'Preview a structured Study Snapshot and AI Summary. Your allowance will appear once your account is connected.':'Generate a structured summary using this paper’s available source text. Your Snapshot allowance is not available yet.'}{refill&&` ${usage.refillAmount?`You will get ${usage.refillAmount} more on`:'Your allowance refills on'} ${refill}.`}</p>
      <div className="snapshot-actions"><UpgradeButton className="snapshot-upgrade" label="Upgrade for unlimited" onClick={onUpgrade}/><button className="outline-button" onClick={onGenerate} disabled={loading||exhausted}>{loading?'Generating Snapshot…':state.status==='failed'?'Retry Snapshot':'Generate Snapshot'}</button></div>
      <p className="snapshot-context">{exhausted?'Your Snapshot allowance has been used. Upgrade or wait for your next refill.':message||'The blurred content below is a preview of the structure, not research findings.'}</p>
    </section>}
    <div role="status" className="snapshot-status">{loading?'Generating Study Snapshot…':state.sample?'Sample Snapshot ready.':result?'Study Snapshot ready.':''}</div>
    {state.error&&<p role="alert" className="snapshot-error">{state.error}</p>}
    {state.sample&&<aside className="snapshot-sample-notice"><strong>Sample content · {SAMPLE_SNAPSHOT.topic}</strong><p>Fictional example for design preview only. This is not an extraction from the paper currently open.</p></aside>}
    {result&&<p className="snapshot-context">{result.sourceType==='abstract'?'Based on the available abstract only. Full text was not analysed.':'Based on the available full-text passages.'} Missing information is shown as “Not reported”.</p>}
    <section className="snapshot-card" aria-labelledby="study-snapshot-title"><h3 id="study-snapshot-title"><FontAwesomeIcon icon={faTableCellsLarge} aria-hidden="true"/>Study Snapshot</h3>
      <dl className="snapshot-fields">{SNAPSHOT_FIELDS.map(field=><div className="snapshot-row" key={field.id}><dt>{field.label}</dt><dd>{result?<Value cell={result.cells[field.id]}/>:state.sample?<p>{SAMPLE_SNAPSHOT.cells[field.id]}</p>:<Preview field={field.id} loading={loading}/>}</dd></div>)}</dl>
    </section>
    <section className="snapshot-card" aria-labelledby="snapshot-summary-title"><h3 id="snapshot-summary-title"><FontAwesomeIcon icon={faWandMagicSparkles} aria-hidden="true"/>AI Summary</h3><div className="snapshot-summary">{result?<Value cell={result.cells['ai-summary']}/>:state.sample?<p>{SAMPLE_SNAPSHOT.cells['ai-summary']}</p>:<Preview field="ai-summary" loading={loading}/>}</div></section>
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
    void service.access().then(value=>{if(active){setAccess(value);if(value.previewAvailable&&samplePapers.has(paper.id)&&!saved)setState({status:'ready',sample:true});}}).catch(e=>{if(active)setAccess({available:false,message:e.message,usage:UNKNOWN_USAGE});});
    return()=>{active=false;mounted.current=false;};
  },[paper,service]);
  async function generate(){
    if(state.status==='loading'||state.snapshot||state.sample)return;
    setState({status:'loading'});
    try{
      const capability=await service.access();if(mounted.current)setAccess(capability);
      if(capability.previewAvailable){samplePapers.add(paper.id);if(mounted.current)setState({status:'ready',sample:true});return;}
      if(!capability.available)throw new Error(capability.message);
      if(!capability.usage.unlimited&&capability.usage.remaining===0)throw new Error('Your Snapshot allowance has been used.');
      const snapshot=await service.generate(paper);
      if(mounted.current)setState({status:'ready',snapshot});
    }catch(e){if(mounted.current)setState({status:'failed',error:e instanceof Error?e.message:'Snapshot generation failed. Please retry.'});}
  }
  return <><SnapshotContent state={state} usage={access.usage} message={access.message} previewAvailable={access.previewAvailable} onGenerate={()=>void generate()} onUpgrade={()=>setUpgrade(true)}/>{upgrade&&<ReferencePaywall reason="snapshot" onClose={()=>setUpgrade(false)}/>}</>;
}
