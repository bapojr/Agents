import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {applyAnalysis,type Analysis} from '../src/ui/evidence/client';
import {normalizeOpenAlex} from '../src/ui/scholarly/openalex';
import {columnValue,REFERENCE_COLUMNS,referencePartition} from '../src/ui/reference-model';
import {SearchAnswer} from '../src/ui/search-answer';
import {defaultPreferences} from '../src/ui/thread-state';
const paper=normalizeOpenAlex({id:'https://openalex.org/W123',title:'Test record only'})!;
const evidence={id:'ev1',claimId:'claim1',documentId:'doc1',passageId:'passage1',text:'Verbatim test source passage.',section:'Abstract',sourceType:'abstract' as const,startOffset:0,endOffset:29};
const analysis:Analysis={documentId:'doc1',question:'Original query',sourceType:'abstract',model:'test-only',cells:{relevance:{claimId:'claim1',status:'supported',value:'Evidence-backed test claim.',evidenceIds:['ev1']},pathway:{claimId:'claim2',status:'not_reported',value:'Not reported',evidenceIds:[]}},evidence:[evidence]};
describe('shared live evidence model',()=>{
 it('uses explicit claim and source IDs and keeps original canonical metadata',()=>{const result=applyAnalysis(paper,analysis);expect(result.id).toBe(paper.id);expect(result.title).toBe(paper.title);expect(result.evidence[0]).toEqual(evidence);expect(result.extractions?.relevance.claimId).toBe('claim1');expect(columnValue(result,REFERENCE_COLUMNS.find(c=>c.id==='pathway')!).text).toBe('Not reported');});
 it('fails closed when evidence belongs to a different document or claim',()=>{for(const ev of [{...evidence,documentId:'wrong'},{...evidence,claimId:'wrong'}]){const result=applyAnalysis(paper,{...analysis,evidence:[ev]});expect(result.extractions?.relevance.status).toBe('not_reported');}});
 it('renders an identified answer claim and its selected highlight',()=>{const result=applyAnalysis(paper,analysis);const html=renderToStaticMarkup(createElement(SearchAnswer,{query:'Original query',provider:'OpenAlex',papers:[result],loading:false,error:'',retry:()=>{},preferences:defaultPreferences,actions:{saved:[],onSave:()=>{},onCopy:()=>{},onOpen:()=>{},onNotice:()=>{}},onReferences:()=>{},onFilter:()=>{},onFollowup:()=>{},showFollowups:false,onDismiss:()=>{},analysisMessage:'',onRetryExtraction:()=>{},onEvidence:()=>{},selectedEvidence:evidence}));expect(html).toContain('id="claim1"');expect(html).toContain('linked-claim');expect(html).toContain('View evidence · Abstract');expect(html).not.toContain('Page undefined');});
 it('keeps extraction limit separate from live results',()=>{const list=Array.from({length:51},(_,i)=>({...paper,id:String(i)}));expect(referencePartition(list).table).toHaveLength(20);expect(referencePartition(list).standard).toHaveLength(31);});
});
