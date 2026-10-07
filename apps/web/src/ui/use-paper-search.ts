'use client';
import {useEffect,useRef,useState} from 'react';
import {mergePapers,searchPapers,type SearchPage} from './paper-data';
const cache = new Map<string, SearchPage>();
export function usePaperSearch(query: string, enabled: boolean) {
  const [data,setData] = useState<SearchPage>({papers:[],total:0});
  const [loading,setLoading] = useState(enabled);
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(()=>{
    if (!enabled) return;
    const cached = cache.get(query);
    if(cached && !attempt) {setData(cached);setLoading(false);return;}
    const controller = new AbortController();request.current=controller;
    setData({papers:[],total:0});setLoading(true);setError('');
    searchPapers(query,controller.signal).then(result=>{
      if(controller.signal.aborted)return;
      cache.set(query,result);if(cache.size>10)cache.delete(cache.keys().next().value!);
      setData(result);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Search timed out. Please try again.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[query,enabled,attempt]);
  async function loadMore() {
    if(loading||!data.nextCursor)return;
    const controller = new AbortController();request.current=controller;setLoading(true);setError('');
    try { const next=await searchPapers(query,controller.signal,data.nextCursor);if(controller.signal.aborted)return;
      const merged={...next,papers:mergePapers(data.papers,next.papers)};cache.set(query,merged);setData(merged);
    } catch(e) {if(!controller.signal.aborted)setError(e instanceof Error?e.message:'More papers could not load. Please retry.');}
    finally {if(!controller.signal.aborted)setLoading(false);}
  }
  useEffect(()=>()=>request.current?.abort(),[]);
  return {...data,loading,error,loadMore,retry:()=>setAttempt(n=>n+1)};
}
