import {describe,it,expect} from 'vitest';
import {searchScholarlyPapers} from '../src/ui/scholarly/service';
import {normalizeOpenAlex} from '../src/ui/scholarly/openalex';

// Explicit opt-in only: these requests hit real OpenAlex records, never fixtures.
describe.skipIf(process.env.RUN_LIVE_SCHOLARLY_TESTS !== '1')('live scholarly contract',()=>{
  const firstIds=new Set<string>();
  it.each([
    "Does Alzheimer's pathology cause dementia?",
    'effects of air pollution on childhood asthma',
    'recent research on CRISPR treatment for sickle cell disease',
    'How does climate change affect coral reef biodiversity?',
    'machine learning for protein structure prediction',
  ])('verifies live records for %s',async query=>{
    const result=await searchScholarlyPapers(query,{signal:new AbortController().signal});
    expect(result.papers.length).toBeGreaterThan(0);
    const p=result.papers[0];
    expect(firstIds.has(p.id)).toBe(false);firstIds.add(p.id);
    const response=await fetch(`https://api.openalex.org/works/${p.providerId}`);
    expect(response.ok).toBe(true);
    const raw=await response.json(),canonical=normalizeOpenAlex(raw)!;
    expect(p.title).toBe(canonical.title);expect(p.authors).toEqual(canonical.authors);
    expect(p.year).toBe(canonical.year);expect(p.doi).toBe(canonical.doi);
    expect(p.url).toBe(canonical.url);expect(p.sources?.[0].recordUrl).toBe(raw.id);
    for(const paper of result.papers)expect(paper.providerId).toMatch(/^W\d+$/);
    if(result.intent.filters.fromYear)expect(result.papers.every(paper=>paper.year!>=result.intent.filters.fromYear!)).toBe(true);
    console.info(JSON.stringify({query,searchText:result.intent.searchText,count:result.total,loaded:result.papers.length,first:{id:p.providerId,title:p.title,authors:p.authors.slice(0,3),year:p.year,doi:p.doi,url:p.url}}));
  },60000);
  it('returns zero real papers for the nonsense query',async()=>{
    const page=await searchScholarlyPapers('xqzvplm completely nonexistent research concept 847293',{signal:new AbortController().signal});
    expect(page.total).toBe(0);expect(page.papers).toEqual([]);console.info('Nonsense query: 0 results, no fallback.');
  },60000);
  it('loads beyond the free table limit with stable identifiers',async()=>{
    const query='air pollution asthma';
    const first=await searchScholarlyPapers(query,{signal:new AbortController().signal});
    expect(first.papers).toHaveLength(50);expect(first.nextCursor).toBeTruthy();
    const next=await searchScholarlyPapers(query,{signal:new AbortController().signal,cursor:first.nextCursor});
    expect(next.papers.length).toBeGreaterThan(0);
    expect(next.papers.every(p=>!first.papers.some(previous=>previous.id===p.id))).toBe(true);
    console.info(`Pagination: ${first.papers.length} initial + ${next.papers.length} additional real records.`);
  },60000);
});
