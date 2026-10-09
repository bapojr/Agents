'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Paper} from '../paper-data';
import type {ReferenceColumn} from '../reference-model';
import {FREE_TABULAR_REFERENCE_LIMIT} from '../reference-model';
import {applyAnalysis,evidenceConfigured,evidenceRequest,extractPaper,type Analysis} from './client';
export function useExtraction(papers:Paper[],question:string,columns:ReferenceColumn[],enabled:boolean){
  const [capability,setCapability]=useState(false);
  const [message,setMessage]=useState(evidenceConfigured?'Checking document analysis…':'');
  const [version,setVersion]=useState(0);
  const [states,setStates]=useState<Record<string,{analysis?:Analysis;status:'loading'|'ready'|'failed';error?:string}>>({});
  const scope=JSON.stringify([question,columns.map(c=>[c.id,c.question,c.label])]);
  const current=useRef(scope);current.current=scope;
  useEffect(()=>{if(!enabled||!evidenceConfigured)return;let active=true;void evidenceRequest<{extraction:boolean}>('capabilities',undefined,version>0).then(c=>{if(active){setCapability(c.extraction);setMessage(c.extraction?'':'AI extraction is not configured on the research server.');}}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[enabled,version]);
  const ids=papers.slice(0,FREE_TABULAR_REFERENCE_LIMIT).map(p=>p.id).join('|');
  useEffect(()=>{
    if(!enabled||!capability||!columns.length)return;
    let active=true;
    const selected=papers.slice(0,FREE_TABULAR_REFERENCE_LIMIT);
    void(async()=>{for(const paper of selected){
      if(!active)return;
      const key=scope+paper.id;
      setStates(s=>({...s,[key]:{status:'loading',analysis:s[key]?.analysis}}));
      try{const analysis=await extractPaper(paper,question,columns,version>0);
        if(active&&current.current===scope)setStates(s=>({...s,[key]:{status:'ready',analysis}}));
      }catch(e){if(active&&current.current===scope)setStates(s=>({...s,[key]:{status:'failed',error:e instanceof Error?e.message:'Extraction failed.'}}));}
    }})();
    return()=>{active=false;};
    // IDs and scope capture the complete source/query/column identity; cache survives view changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ids,scope,capability,enabled,version]);
  const enriched=useMemo(()=>papers.map(p=>{const state=states[scope+p.id];return state?.analysis?applyAnalysis(p,state.analysis):{...p,analysisStatus:state?.status,analysisError:state?.error};}),[papers,states,scope]);
  return {papers:enriched,enabled:capability,message,retry:()=>setVersion(v=>v+1)};
}
