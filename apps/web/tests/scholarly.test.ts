import {describe,it,expect,vi} from 'vitest';
import work from './fixtures/openalex-work.json';
import {normalizeOpenAlex,reconstructAbstract,openAlexSearchUrl,parseOpenAlexPage,OpenAlexProvider} from '../src/ui/scholarly/openalex';
import {processResearchQuery} from '../src/ui/scholarly/query';
import {fetchScholarlyJSON} from '../src/ui/scholarly/http';
import {searchScholarlyPapers,resolveRetrievedCitations,LIVE_SEARCH_ENABLED} from '../src/ui/scholarly/service';
import {mergePapers} from '../src/ui/paper-data';
import type {ScholarlyProvider} from '../src/ui/scholarly/types';

describe('OpenAlex normalization from a captured real record',()=>{
  it('retains canonical identifiers and exact provider metadata',()=>{
    const paper=normalizeOpenAlex(work)!;
    expect(paper.title).toBe(work.title);
    expect(paper.authors).toEqual(work.authorships.map(a=>a.author.display_name));
    expect(paper.year).toBe(work.publication_year);
    expect(paper.doi).toBe(work.doi.replace('https://doi.org/',''));
    expect(paper.identifiers?.openalex).toBe(work.id.split('/').at(-1));
    expect(paper.sources?.[0].recordUrl).toBe(work.id);
    expect(paper.citationCount).toBe(work.cited_by_count);
    expect(paper.openAccess).toBe(work.open_access.is_oa);
    expect(paper.pdf).toBe(work.best_oa_location.pdf_url);
    expect(paper.quartile).toBeUndefined();expect(paper.verified).toBeUndefined();
  });
  it('requires a real provider ID and title, but does not require a DOI',()=>{
    expect(normalizeOpenAlex({...work,id:undefined})).toBeNull();
    expect(normalizeOpenAlex({...work,id:'https://example.com/W123'})).toBeNull();
    expect(normalizeOpenAlex({...work,title:'',display_name:''})).toBeNull();
    const paper=normalizeOpenAlex({id:work.id,title:work.title})!;
    expect(paper.id).toBe(`openalex:${work.id.split('/').at(-1)}`);
    expect(paper.url).toBe(work.id);
    expect(paper.year).toBeUndefined();expect(paper.abstract).toBeUndefined();
    expect(paper.citationCount).toBeUndefined();expect(paper.openAccess).toBeUndefined();
    expect(paper.pdf).toBeUndefined();expect(paper.journal).toBe('');expect(paper.authors).toEqual([]);
  });
  it('only reconstructs words from valid complete inverted indexes',()=>{
    expect(reconstructAbstract({Research:[0],supports:[1],this:[2]})).toBe('Research supports this');
    for(const value of [null,{Gap:[2]},{Bad:[-1]},{TooBig:[50001]},{Duplicate:[0],Collision:[0]},{Invalid:['0']},{Incomplete:[0,3]}])expect(reconstructAbstract(value)).toBeUndefined();
  });
  it('rejects unsafe source links and preserves zero/false metadata',()=>{
    const paper=normalizeOpenAlex({...work,cited_by_count:0,open_access:{is_oa:false},locations:[],primary_location:{pdf_url:'javascript:alert(1)'},best_oa_location:null})!;
    expect(paper.citationCount).toBe(0);expect(paper.openAccess).toBe(false);expect(paper.pdf).toBeUndefined();
  });
  it('distinguishes malformed records from a genuine empty result',()=>{
    expect(parseOpenAlexPage({meta:{count:0,next_cursor:null},results:[]})).toEqual({papers:[],total:0,nextCursor:undefined});
    for(const value of [{},{meta:{count:'0'},results:[]},{meta:{count:1},results:[{title:'No provider ID'}]}])expect(()=>parseOpenAlexPage(value)).toThrow();
  });
});

describe('natural research query intent',()=>{
  it('preserves meaning and original query without adding domain-specific examples',()=>{
    const original="Does Alzheimer's pathology cause dementia?";
    const intent=processResearchQuery(original);
    expect(intent.originalQuery).toBe(original);expect(intent.searchText).toBe("Alzheimer's pathology cause dementia");
    expect(intent.filters).toEqual({});
    expect(processResearchQuery('papers on outcomes without antibiotics').searchText).toContain('without antibiotics');
  });
  it.each([
    ['papers on asthma since 2022',{fromYear:2022}],
    ['papers on asthma after 2022',{fromYear:2023}],
    ['papers on asthma before 2020',{toYear:2019}],
    ['papers on asthma between 2020 and 2022',{fromYear:2020,toYear:2022}],
    ['asthma papers published in 2024',{fromYear:2024,toYear:2024}],
    ['recent papers on asthma',{fromYear:2022,toYear:2026}],
    ['asthma in the last 3 years',{fromYear:2024,toYear:2026}],
  ])('maps explicit date intent: %s',(query,filters)=>expect(processResearchQuery(query,2026).filters).toEqual(filters));
  it('does not interpret topic years as publication dates',()=>expect(processResearchQuery('COVID-19 outbreak in 2020').filters).toEqual({}));
  it('keeps systematic specificity while applying the broader provider review type',()=>{
    const intent=processResearchQuery('systematic reviews about asthma');
    expect(intent.filters.publicationType).toBe('review');expect(intent.searchText).toContain('systematic');
  });
  it('maps author byline requests without treating causal wording as author names',()=>{
    expect(processResearchQuery('papers by Jane Smith on asthma').filters.author).toBe('Jane Smith');
    expect(processResearchQuery('papers on asthma caused by pollution').filters.author).toBeUndefined();
  });
  it('rejects empty, overly long, and inverted date-range queries',()=>{
    for(const q of ['', 'gene '.repeat(1000),'papers between 2024 and 2020'])expect(()=>processResearchQuery(q)).toThrow();
  });
  it('encodes user input and keeps relevance ranking as the default',()=>{
    const url=new URL(openAlexSearchUrl(processResearchQuery('air pollution &cursor=bad since 2022')));
    expect(url.searchParams.get('cursor')).toBe('*');expect(url.searchParams.get('sort')).toBeNull();
    expect(url.searchParams.get('per_page')).toBe('50');expect(url.searchParams.get('filter')).toBe('from_publication_date:2022-01-01');
  });
});

describe('strict live result contract and interchangeable adapters',()=>{
  const signal=()=>new AbortController().signal;
  const provider=(search:ScholarlyProvider['search']):ScholarlyProvider=>({id:'test',name:'Test source',search});
  it('returns only provider records and preserves the original question',async()=>{
    const paper=normalizeOpenAlex(work)!;
    const result=await searchScholarlyPapers('air pollution',{signal:signal()},provider(async()=>({papers:[paper],total:1})));
    expect(result.papers).toEqual([paper]);expect(result.intent.originalQuery).toBe('air pollution');expect(LIVE_SEARCH_ENABLED).toBe(true);
  });
  it('returns zero on no matches and never falls back on failures',async()=>{
    expect((await searchScholarlyPapers('no matches',{signal:signal()},provider(async()=>({papers:[],total:0})))).papers).toEqual([]);
    await expect(searchScholarlyPapers('q',{signal:signal()},provider(async()=>{throw new Error('offline');}))).rejects.toThrow('offline');
    await expect(searchScholarlyPapers('q',{signal:signal()},provider(async()=>({papers:[{...normalizeOpenAlex(work)!,providerId:undefined}],total:1})))).rejects.toThrow('provider identifier');
  });
  it('binds opaque pagination to the query and provider',async()=>{
    const search=vi.fn().mockResolvedValue({papers:[normalizeOpenAlex(work)!],total:100,nextCursor:'token'});
    const adapter=provider(search),first=await searchScholarlyPapers('asthma',{signal:signal()},adapter);
    await searchScholarlyPapers('asthma',{signal:signal(),cursor:first.nextCursor},adapter);
    expect(search.mock.calls[1][2]).toBe('token');
    await expect(searchScholarlyPapers('different',{signal:signal(),cursor:first.nextCursor},adapter)).rejects.toThrow('different search');
    expect(search).toHaveBeenCalledTimes(2);
  });
  it('deduplicates provider IDs/DOI and retains provenance and stable order',()=>{
    const p=normalizeOpenAlex(work)!,cross={...p,id:'crossref-record',provider:'Crossref',providerId:p.doi,identifiers:{doi:p.doi.toUpperCase()},sources:[{provider:'Crossref',providerId:p.doi,recordUrl:p.url}]};
    const papers=mergePapers([p],[cross]);expect(papers).toHaveLength(1);expect(papers[0].id).toBe(p.id);expect(papers[0].sources).toHaveLength(2);expect(papers[0].identifiers?.openalex).toBe(p.providerId);
    expect(mergePapers([p],[{...p,id:'different',doi:'10.1234/different',identifiers:{doi:'10.1234/different'},sources:[]}])).toHaveLength(2);
  });
  it('rejects citations outside the exact retrieved set',()=>{
    const p=normalizeOpenAlex(work)!;expect(resolveRetrievedCitations([p.id],[p])).toEqual([p]);expect(()=>resolveRetrievedCitations(['invented'],[p])).toThrow('not part');
  });
});

describe('provider error states',()=>{
  it.each([[429,'rate-limit'],[500,'unavailable'],[403,'access'],[400,'query']])('classifies HTTP %s',async(status,code)=>{
    await expect(fetchScholarlyJSON('https://api.openalex.org/works',new AbortController().signal,vi.fn().mockResolvedValue({ok:false,status}))).rejects.toMatchObject({code});
  });
  it('classifies malformed JSON and network failure',async()=>{
    await expect(fetchScholarlyJSON('url',new AbortController().signal,vi.fn().mockResolvedValue({ok:true,json:()=>{throw Error();}}))).rejects.toMatchObject({code:'malformed'});
    await expect(fetchScholarlyJSON('url',new AbortController().signal,vi.fn().mockRejectedValue(new TypeError('network')))).rejects.toMatchObject({code:'network'});
  });
  it('cancels abandoned requests without making up a replacement result',async()=>{
    const controller=new AbortController();controller.abort();
    const request=vi.fn().mockImplementation((_url,init)=>{expect(init.signal.aborted).toBe(true);throw new DOMException('aborted','AbortError');});
    await expect(new OpenAlexProvider(request).search(processResearchQuery('q'),controller.signal)).rejects.toMatchObject({name:'AbortError'});
  });
  it('distinguishes timeout from zero results',async()=>{
    vi.useFakeTimers();
    try {
      const request=vi.fn().mockImplementation((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))));
      const pending=expect(fetchScholarlyJSON('url',new AbortController().signal,request)).rejects.toMatchObject({code:'timeout'});
      await vi.advanceTimersByTimeAsync(25001);await pending;
    } finally {vi.useRealTimers();}
  });
});
