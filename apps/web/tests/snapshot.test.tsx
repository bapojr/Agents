import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {SnapshotContent} from '../src/ui/snapshot/paper-snapshot';
import {normalizeSnapshot,readSnapshotUsage,SNAPSHOT_COLUMNS,SNAPSHOT_QUESTION,UNKNOWN_USAGE} from '../src/ui/snapshot/model';
import {createSnapshotService} from '../src/ui/snapshot/service';
import {SAMPLE_SNAPSHOT,SNAPSHOT_PREVIEW_COPY} from '../src/ui/snapshot/sample';
import type {Paper} from '../src/ui/paper-data';
// Test doubles exercise the API contract only; never imported into the product.
const paper=(id='W1')=>({id,providerId:id,identifiers:{openalex:id}} as Paper);
function response(text='A test-only source reports its study objective.',sourceType='abstract'){
  return {documentId:'doc-1',question:SNAPSHOT_QUESTION,sourceType,model:'test-double',
    cells:Object.fromEntries(SNAPSHOT_COLUMNS.map(c=>[c.id,{claimId:`claim:${c.id}`,value:c.id==='objective'?text:'Not reported',status:c.id==='objective'?'supported':'not_reported',evidenceIds:c.id==='objective'?['e1']:[]}])),
    evidence:[{id:'e1',claimId:'claim:objective',documentId:'doc-1',passageId:'p1',text,sourceType:'abstract',page:null,startOffset:0,endOffset:text.length}]};
}
const render=(state:Parameters<typeof SnapshotContent>[0]['state'],usage=UNKNOWN_USAGE)=>renderToStaticMarkup(createElement(SnapshotContent,{state,usage,message:'',onGenerate:()=>{},onUpgrade:()=>{}}));
describe('Snapshot display and grounding',()=>{
 it('uses the requested placeholder copy in all eight blurred sections',()=>{
  const html=render({status:'idle'});
  for(const copy of Object.values(SNAPSHOT_PREVIEW_COPY))expect(html).toContain(copy);
 });
 it('shows a clearly labelled filled sample without blur or fabricated source evidence',()=>{
  const html=render({status:'ready',sample:true});
  for(const copy of Object.values(SAMPLE_SNAPSHOT.cells))expect(html).toContain(copy);
  expect(html).toContain('Fictional example for design preview only');
  expect(html).not.toContain('snapshot-preview');expect(html).not.toContain('Supporting source');
  expect(html).not.toContain('Generate Snapshot');expect(html).not.toContain('Based on the available abstract');
 });

 it('shows both generation controls and blurred, non-research previews with readable field labels',()=>{
  const html=render({status:'idle'});
  for(const column of SNAPSHOT_COLUMNS)expect(html).toContain(column.label);
  expect(html).toContain('Generate Snapshot');expect(html).toContain('Upgrade for unlimited');
  expect((html.match(/class="snapshot-preview"/g)||[])).toHaveLength(8);
  expect(html).toContain('aria-hidden="true"');expect(html).toContain('Preview only.');
  expect(html).not.toMatch(/8 Study|October|Alzheimer|Dementia/);
 });
 it('keeps structure visible and announces loading, with Generate disabled',()=>{
  const html=render({status:'loading'});expect(html).toContain('aria-busy="true"');expect(html).toContain('Generating Study Snapshot…');expect(html).toContain('disabled');
 });
 it('reveals only supported values, labels abstract scope and removes the large CTA panel',()=>{
  const html=render({status:'ready',snapshot:normalizeSnapshot('W1',response())});
  expect(html).toContain('test-only source');expect(html).toContain('Not reported');expect(html).toContain('available abstract only');
  expect(html).not.toContain('snapshot-preview');expect(html).not.toContain('Generate Snapshot');expect(html).toContain('Supporting source');
 });
 it('displays supplied quota and refill without synthesizing either',()=>{
  const usage=readSnapshotUsage({remaining:2,unlimited:false,refillAt:'2030-06-01T12:00:00Z',refillAmount:10});
  const html=render({status:'idle'},usage);expect(html).toContain('2 Study Snapshots left');expect(html).toContain('10 more on June 1, 2030');
  expect(render({status:'idle'},{...usage,remaining:0})).toContain('disabled');
  expect(readSnapshotUsage({remaining:-1})).toEqual(UNKNOWN_USAGE);
 });
 it('rejects absent text and malformed or incomplete generation',()=>{
  expect(()=>normalizeSnapshot('W1',response(undefined,'none'))).toThrow('No usable abstract');
  expect(()=>normalizeSnapshot('W1',{})).toThrow('invalid response');
  const raw=response();delete (raw.cells as Record<string,unknown>).methods;expect(()=>normalizeSnapshot('W1',raw)).toThrow('incomplete');
 });
 it.each(['claimId','documentId','sourceType','startOffset'])('rejects mismatched evidence %s',field=>{
  const raw=response();Object.assign(raw.evidence[0],{[field]:field==='startOffset'?1:field==='sourceType'?'full_text':'wrong'});
  expect(normalizeSnapshot('W1',raw).cells.objective).toMatchObject({value:'Not reported',status:'not_reported',evidence:[]});
 });
 it('shows retry and never presents a provider failure as a generated Snapshot',()=>{
  const html=render({status:'failed',error:'Provider unavailable'});expect(html).toContain('role="alert"');expect(html).toContain('Retry Snapshot');expect(html).toContain('snapshot-preview');
 });
});
describe('Snapshot service and cache',()=>{
 it('has an honest disconnected state and performs no fake API request',async()=>{
  const fetcher=vi.fn();const service=createSnapshotService('',fetcher);
  expect(await service.access()).toMatchObject({available:false,previewAvailable:true});await expect(service.generate(paper())).rejects.toThrow('connected');expect(fetcher).not.toHaveBeenCalled();
 });
 it('coalesces double clicks, caches after reopening/reloading, and separates papers',async()=>{
  let stored:string|null=null;
  const storage={getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;}} as Storage;
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json(response()));
  const service=createSnapshotService('https://service.test/evidence',fetcher,()=>storage);
  const first=service.generate(paper());const second=service.generate(paper());expect(first).toBe(second);
  await first;expect(service.cached(paper())?.workId).toBe('W1');await service.generate(paper());expect(fetcher).toHaveBeenCalledTimes(1);
  const restored=createSnapshotService('https://service.test/evidence',fetcher,()=>storage);await restored.generate(paper());expect(fetcher).toHaveBeenCalledTimes(1);
  await restored.generate(paper('W2'));expect(fetcher).toHaveBeenCalledTimes(2);
  const body=JSON.parse(fetcher.mock.calls[0][1]!.body as string);expect(body.workId).toBe('W1');expect(body.columns).toHaveLength(8);expect(body.question).toBe(SNAPSHOT_QUESTION);
 });
 it('never caches a failed request and permits retry',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(Response.json(response()));
  const service=createSnapshotService('https://service.test',fetcher);
  await expect(service.generate(paper())).rejects.toThrow('unavailable');expect(service.cached(paper())).toBeUndefined();await service.generate(paper());expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('isolates completely different paper results',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json(response('First test-only source text with enough characters.'))).mockResolvedValueOnce(Response.json(response('Second test-only source text with different findings.')));
  const service=createSnapshotService('https://service.test',fetcher);
  const a=await service.generate(paper('W1')),b=await service.generate(paper('W2'));
  expect(a.cells.objective.value).not.toBe(b.cells.objective.value);expect(service.cached(paper('W1'))).toBe(a);
 });
 it('uses the existing capabilities contract and optional server quota',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({extraction:true,snapshotUsage:{remaining:4,unlimited:false,refillAt:null,refillAmount:null}}));
  expect(await createSnapshotService('https://service.test',fetcher).access()).toMatchObject({available:true,usage:{remaining:4}});
 });
 it('never silently enables samples when a configured backend fails',async()=>{
  const service=createSnapshotService('https://service.test',vi.fn().mockResolvedValue(new Response('',{status:503})));
  await expect(service.access()).rejects.toThrow('unavailable');
 });
 it('requires a real canonical work ID' ,async()=>{
  const fetcher=vi.fn();await expect(createSnapshotService('https://service.test',fetcher).generate(paper('demo'))).rejects.toThrow('OpenAlex');expect(fetcher).not.toHaveBeenCalled();
 });
});
