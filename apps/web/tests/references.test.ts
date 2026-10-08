import {describe,it,expect,vi} from 'vitest';
import {normalizeCrossref,parseSearchPage,searchPapers,searchUrl} from '../src/ui/scholarly/crossref';
import {mergePapers,abstractExcerpt,plainText,type Paper} from '../src/ui/paper-data';
import {FREE_ENTITLEMENTS,FREE_TABULAR_REFERENCE_LIMIT,REFERENCE_COLUMNS,referencePartition,requestReferenceExport,columnValue,addReferenceColumn} from '../src/ui/reference-model';
import {filterPapers} from '../src/ui/research-preview';
import {emptyFilters} from '../src/ui/research-filters';
import {formatCitation,exportFormats} from '../src/ui/thread-state';
const paper=(n:number):Paper=>normalizeCrossref({DOI:`10.1234/test.${n}`,title:[`A query-dependent paper ${n}`]})!;
describe('one normalized source record',()=>{
 it('keeps absent metadata absent and never asserts OA/verification',()=>{
  const p=paper(1);expect(p.year).toBeUndefined();expect(p.citationCount).toBeUndefined();expect(p.openAccess).toBeUndefined();expect(p.quartile).toBeUndefined();expect(p.abstract).toBeUndefined();expect(p.verified).toBeUndefined();expect(p.authors).toEqual([]);expect(p.journal).toBe('');
  for(const format of exportFormats)expect(formatCitation(p,format)).not.toMatch(/undefined|null|NaN/);
  expect(formatCitation(p,'BibTeX')).toMatch(/^@article\{/);
  expect(formatCitation(p,'BibTeX')).not.toContain('year =');
 });
 it('retains zero citations, long titles/authors, and source abstract as text',()=>{
  const p=normalizeCrossref({DOI:'10.1234/abc',title:['Long '.repeat(500)],author:Array.from({length:200},(_,n)=>({given:'Author',family:String(n)})),abstract:'<jats:p>A &amp; B</jats:p>',published:{'date-parts':[[2024]]},'is-referenced-by-count':0,'container-title':['Journal']})!;
  expect(p.title.length).toBeGreaterThan(2000);expect(p.authors).toHaveLength(200);expect(p.abstract).toBe('A & B');expect(p.evidence[0].text).toBe(p.abstract);expect(p.citationCount).toBe(0);expect(p.year).toBe(2024);
 });
 it('rejects invalid records and malformed API responses',()=>{expect(normalizeCrossref({title:['X']})).toBeNull();expect(()=>parseSearchPage({})).toThrow('invalid response');expect(plainText('&#99999999;')).toBe('');});
 it('updates matching records without duplicating references',()=>{const old=paper(1),next={...old,title:'Updated metadata'};const merged=mergePapers([old],[next,paper(2)]);expect(merged).toHaveLength(2);expect(merged[0].title).toBe(next.title);});
 it('handles empty response and cursor pagination',()=>{expect(parseSearchPage({message:{items:[],'total-results':0}})).toEqual({papers:[],total:0,nextCursor:undefined});const items=Array.from({length:50},(_,n)=>({DOI:`10.1234/${n}`,title:[`Title ${n}`]}));expect(parseSearchPage({message:{items,'total-results':500,'next-cursor':'next'}}).nextCursor).toBe('next');expect(parseSearchPage({message:{items:items.slice(0,1),'total-results':1,'next-cursor':'next'}}).nextCursor).toBeUndefined();});
 it('passes research queries as encoded data, not URL parameters',()=>{const u=new URL(searchUrl('climate &rows=1#x'));expect(u.searchParams.get('query.bibliographic')).toBe('climate &rows=1#x');expect(u.searchParams.get('rows')).toBe('50');});
 it('reports rate limiting and API errors without example fallback',async()=>{const request=vi.fn().mockResolvedValue({ok:false,status:429});await expect(searchPapers('query',new AbortController().signal,'*',request)).rejects.toThrow('busy');expect(request).toHaveBeenCalledOnce();});
 it('aborts stale requests',async()=>{const control=new AbortController();control.abort();const request=vi.fn().mockImplementation((_url,options)=>{expect(options.signal.aborted).toBe(true);throw new Error('aborted');});await expect(searchPapers('q',control.signal,'*',request)).rejects.toThrow('aborted');});
 it('does not invent values when metadata-specific filters apply',()=>{const p=paper(1);expect(filterPapers([p],emptyFilters())).toHaveLength(1);for(const filters of [{year:{kind:'last' as const,years:5}},{openAccess:true},{minCitations:1},{quartiles:['Q1']},{hasPdf:true}])expect(filterPapers([p],{...emptyFilters(),...filters})).toHaveLength(0);});
 it('limits abstract excerpt to a truthful prefix',()=>{const p={...paper(1),abstract:'Available source text. '.repeat(100)};expect(p.abstract.startsWith(abstractExcerpt(p).replace(/…$/,''))).toBe(true);expect(abstractExcerpt(p).length).toBeLessThanOrEqual(501);});
});
describe('free reference limit and paid export',()=>{
 it.each([0,1,7,19,20,21,50,10000])('partitions %i records without hiding or duplicating any',n=>{
  const items=Array.from({length:n},(_,i)=>paper(i)),r=referencePartition(items);
  expect(r.table).toHaveLength(Math.min(n,20));expect(r.standard).toHaveLength(Math.max(n-20,0));expect(r.showUpgrade).toBe(n>20);expect([...r.table,...r.standard]).toEqual(items);
  expect(r.table[0]).toBe(items[0]);if(n>20)expect(r.standard[0]).toBe(items[20]);
 });
 it('does not mutate underlying data across views/columns',()=>{const items=Array.from({length:21},(_,i)=>paper(i));const ids=items.map(p=>p.id);referencePartition(items);REFERENCE_COLUMNS.forEach(c=>columnValue(items[0],c));expect(items.map(p=>p.id)).toEqual(ids);});
 it('gates before exporting and supports trusted future entitlements',()=>{const upgrade=vi.fn(),download=vi.fn();expect(requestReferenceExport(FREE_ENTITLEMENTS,upgrade,download)).toBe(false);expect(upgrade).toHaveBeenCalledOnce();expect(download).not.toHaveBeenCalled();expect(requestReferenceExport({canExport:true,tabularReferenceLimit:100},upgrade,download)).toBe(true);expect(download).toHaveBeenCalledOnce();expect(FREE_TABULAR_REFERENCE_LIMIT).toBe(20);});
 it('allows an entitled limit without a nudge',()=>expect(referencePartition(Array.from({length:30},(_,i)=>paper(i)),{canExport:true,tabularReferenceLimit:100}).showUpgrade).toBe(false));
});
describe('column values',()=>{
 it('never fabricates missing scholarly extraction fields',()=>{for(const c of REFERENCE_COLUMNS)expect(columnValue(paper(1),c).text).toBe('Not extracted');});
 it('only surfaces enhanced extraction with supporting evidence',()=>{const p={...paper(1),extractions:{pathway:{value:'A pathway',evidence:'Source passage',sourceUrl:'https://doi.org/10.1234/test.1'}}};expect(columnValue(p,REFERENCE_COLUMNS[2]).text).toBe('A pathway');p.extractions.pathway.evidence='';expect(columnValue(p,REFERENCE_COLUMNS[2]).text).toBe('Not extracted');});
 it('labels raw abstracts as excerpts rather than AI summaries',()=>{expect(columnValue({...paper(1),abstract:'Original source text'},REFERENCE_COLUMNS[4]).text).toBe('Abstract excerpt: Original source text');});
 it('adds a custom name/question without inventing values',()=>{const next=addReferenceColumn(REFERENCE_COLUMNS,' Country ',' Which country? ');const col=next.at(-1)!;expect(col.label).toBe('Country');expect(col.question).toBe('Which country?');expect(columnValue(paper(1),col).text).toBe('Not extracted');expect(()=>addReferenceColumn(next,'country','q')).toThrow('already exists');expect(()=>addReferenceColumn(next,'','')).toThrow('Enter');expect(addReferenceColumn(next,'Future Scope','').at(-1)?.label).toBe('Future Scope');});
});
