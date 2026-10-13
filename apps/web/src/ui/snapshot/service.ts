import type {Paper} from '../paper-data';
import {normalizeSnapshot,readSnapshotUsage,SNAPSHOT_COLUMNS,SNAPSHOT_QUESTION,snapshotWorkId,UNKNOWN_USAGE,type Snapshot,type SnapshotUsage} from './model';

export type SnapshotAccess = {available:boolean;message:string;usage:SnapshotUsage;previewAvailable?:boolean};
export type SnapshotService = {access:()=>Promise<SnapshotAccess>;generate:(paper:Paper)=>Promise<Snapshot>;cached:(paper:Paper)=>Snapshot|undefined;inFlight:(paper:Paper)=>Promise<Snapshot>|undefined};
const endpoint=process.env.NEXT_PUBLIC_RESEARCH_API_URL || '';
const STORAGE_KEY='agents-study-snapshots-v1';
const unavailable='Snapshot generation needs the research AI service to be connected. Your paper is still available in the other tabs.';
/** Adapter for the existing protected /evidence/capabilities and /evidence/extract API.
 * No provider secrets, browser-side AI, or substitute research data. */
export function createSnapshotService(base:string,request:typeof fetch=fetch,storage?:()=>Storage|undefined):SnapshotService {
  const cache=new Map<string,{raw:unknown;snapshot:Snapshot}>();
  const pending=new Map<string,Promise<Snapshot>>();
  let loaded=false;
  function restore(){
    if(loaded)return;loaded=true;
    try{const entries=JSON.parse(storage?.()?.getItem(STORAGE_KEY)||'[]');
      if(Array.isArray(entries))for(const [id,raw] of entries.slice(-30)){if(/^W\d+$/.test(id))cache.set(id,{raw,snapshot:normalizeSnapshot(id,raw)});}
    }catch{/* Invalid or unavailable browser storage never prevents generation. */}
  }
  async function api(path:string,body?:unknown):Promise<unknown>{
    if(!base)throw new Error(unavailable);
    let response:Response;
    try{response=await request(`${base.replace(/\/$/,'')}/${path}`,{method:body?'POST':'GET',credentials:'include',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(245000)});}
    catch(error){throw new Error(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'Snapshot generation timed out. Please retry.':'The Snapshot service could not be reached. Please retry.');}
    if(!response.ok){
      if(response.status===401||response.status===403)throw new Error('Sign in to the connected research service to generate a Snapshot.');
      if(response.status===429)throw new Error('The Snapshot service is busy or your allowance has been reached. Please try again later.');
      throw new Error('Snapshot generation is currently unavailable. Please retry.');
    }
    try{return await response.json();}catch{throw new Error('The Snapshot service returned an invalid response. Please retry.');}
  }
  return {
    async access(){
      if(!base)return {available:false,previewAvailable:true,message:'Preview mode: Generate Snapshot displays sample content until AI generation is connected.',usage:UNKNOWN_USAGE};
      const value=await api('capabilities') as {extraction?:boolean;snapshotUsage?:unknown};
      return {available:value?.extraction===true,message:value?.extraction===true?'':'AI Snapshot generation is not configured on the research service.',usage:readSnapshotUsage(value?.snapshotUsage)};
    },
    inFlight(paper){return pending.get(snapshotWorkId(paper));},
    cached(paper){restore();return cache.get(snapshotWorkId(paper))?.snapshot;},
    generate(paper){
      restore();const id=snapshotWorkId(paper);
      if(!/^W\d+$/.test(id))return Promise.reject(new Error('A real OpenAlex paper record is required to generate a Snapshot.'));
      const existing=cache.get(id);if(existing)return Promise.resolve(existing.snapshot);
      if(pending.has(id))return pending.get(id)!;
      const job=api('extract',{workId:id,question:SNAPSHOT_QUESTION,columns:SNAPSHOT_COLUMNS}).then(raw=>{
        const snapshot=normalizeSnapshot(id,raw);cache.set(id,{raw,snapshot});
        // Bounded cache for this browser tab/session, not a cross-account durable library.
        if(cache.size>30)cache.delete(cache.keys().next().value!);
        try{storage?.()?.setItem(STORAGE_KEY,JSON.stringify([...cache].map(([key,value])=>[key,value.raw])));}catch{/* Keep the in-memory session result. */}
        return snapshot;
      }).finally(()=>pending.delete(id));
      pending.set(id,job);return job;
    },
  };
}
export const snapshotService=createSnapshotService(endpoint,fetch,()=>typeof window==='undefined'?undefined:window.sessionStorage);
