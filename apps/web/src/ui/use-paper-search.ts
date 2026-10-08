"use client";
import {useEffect,useRef,useState} from 'react';
import {mergePapers} from './paper-data';
import {LIVE_SEARCH_ENABLED,PRIMARY_SCHOLARLY_SOURCE,searchScholarlyPapers} from './scholarly/service';
import type {SearchPage} from './scholarly/types';

export function usePaperSearch(query: string, enabled: boolean) {
  const [data,setData] = useState<SearchPage | null>(null);
  const [loading,setLoading] = useState(enabled);
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(()=>{
    request.current?.abort();
    if (!enabled || !LIVE_SEARCH_ENABLED) return;
    const controller = new AbortController(); request.current=controller;
    setData(null);setLoading(true);setError('');
    searchScholarlyPapers(query,{signal:controller.signal}).then(result=>{
      if (!controller.signal.aborted) setData(result);
    }).catch(e=>{
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Search could not complete. Please retry.');
    }).finally(()=>{
      if (request.current===controller) {request.current=null;setLoading(false);}
    });
    return ()=>{controller.abort();request.current?.abort();};
  },[query,enabled,attempt]);
  async function loadMore() {
    if (request.current || !data?.nextCursor) return;
    const controller = new AbortController();request.current=controller;setLoading(true);setError('');
    try {
      const next=await searchScholarlyPapers(query,{signal:controller.signal,cursor:data.nextCursor});
      if (!controller.signal.aborted) setData({...next,papers:mergePapers(data.papers,next.papers)});
    } catch(e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'More papers could not load. Please retry.');
    } finally {
      if (request.current===controller) {request.current=null;setLoading(false);}
    }
  }
  return {papers:data?.papers || [],total:data?.total || 0,nextCursor:data?.nextCursor,
    provider:data?.provider || PRIMARY_SCHOLARLY_SOURCE,intent:data?.intent,
    loading,error,loadMore,retry:()=>setAttempt(n=>n+1)};
}
