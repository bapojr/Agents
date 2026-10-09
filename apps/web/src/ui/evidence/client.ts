import type {Evidence, Paper} from '../paper-data';
import type {ReferenceColumn} from '../reference-model';
export type SourceDocument={id:string;workId:string;title:string;sourceUrl?:string;sourceType:'full_text'|'abstract'|'none';pdfStatus:'available'|'unavailable'|'failed';message:string;pages:{number:number;width:number;height:number}[];passages:{id:string;text:string;sourceType:'full_text'|'abstract';pageNumber?:number}[]};
export type Analysis={documentId:string;sourceUrl?:string|null;question:string;sourceType:'full_text'|'abstract'|'none';model:string;cells:Record<string,{claimId:string;value:string;status:'supported'|'not_reported';evidenceIds:string[]}>;evidence:Evidence[]};
const base=process.env.NEXT_PUBLIC_RESEARCH_API_URL || (process.env.NEXT_PUBLIC_BASE_PATH?'':'/api/evidence');
export const evidenceConfigured=!!base;
export function evidenceUrl(path:string){return `${base.replace(/\/$/,'')}/${path}`;}
const requests=new Map<string,Promise<unknown>>();
export async function evidenceRequest<T>(path:string,body?:unknown,retry=false):Promise<T>{
  if(!base)throw new Error('Live document analysis needs a connected research backend.');
  const key=path+JSON.stringify(body??null);
  if(retry)requests.delete(key);
  if(!requests.has(key)){
    const pending=(async()=>{
      const response=await fetch(evidenceUrl(path)+(retry&&path.startsWith('documents/')?'?retry=true':''),{credentials:'include',method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(245000)});
      if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||error.detail||'The document service is unavailable. Please retry.');}
      return response.json();
    })();
    requests.set(key,pending);
    pending.catch(()=>requests.delete(key));
    // Session cache is bounded, including successful requests. No persistent scholarly text storage.
    if(requests.size>150)requests.delete(requests.keys().next().value!);
  }
  return requests.get(key) as Promise<T>;
}
export function workId(paper:Paper){return paper.identifiers?.openalex||paper.providerId;}
export function loadDocument(paper:Paper,retry=false){const id=workId(paper);if(!id||!/^W\d+$/.test(id))return Promise.reject(new Error('A canonical OpenAlex record is required.'));return evidenceRequest<SourceDocument>(`documents/${id}`,undefined,retry);}
export function extractPaper(paper:Paper,question:string,columns:ReferenceColumn[],retry=false){return evidenceRequest<Analysis>('extract',{workId:workId(paper),question,columns:columns.map(c=>({id:c.id,label:c.label,question:c.question||''}))},retry);}
export function applyAnalysis(paper:Paper,analysis:Analysis):Paper{
  const evidence=analysis.evidence.filter(e=>e.documentId===analysis.documentId&&e.claimId&&e.passageId&&e.text&&e.sourceType);
  const extractions=Object.fromEntries(Object.entries(analysis.cells).map(([id,cell])=>{
    const passages=evidence.filter(e=>cell.evidenceIds.includes(e.id)&&e.claimId===cell.claimId);
    const supported=cell.status==='supported'&&passages.length>0;
    return [id,{value:supported?cell.value:'Not reported',status:supported?'supported' as const:'not_reported' as const,claimId:cell.claimId,evidence:passages.map(e=>e.text).join('\n'),evidenceIds:passages.map(e=>e.id),sourceUrl:analysis.sourceUrl||paper.url,sourceType:analysis.sourceType}];
  }));
  return {...paper,extractions:{...paper.extractions,...extractions},evidence,analysisSource:analysis.sourceType,analysisStatus:'ready'};
}
