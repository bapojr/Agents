import {z} from 'zod';
import type {Paper} from '../paper-data';

export const SNAPSHOT_FIELDS = [
  {id:'objective',label:'Objective',question:'What objective or research question does the paper explicitly state?'},
  {id:'methods',label:'Methods',question:'What study design and methods were used?'},
  {id:'population',label:'Population',question:'What population, organisms or study systems were studied?'},
  {id:'sample-size',label:'Sample size',question:'What exact sample size is reported? Do not infer or calculate it.'},
  {id:'outcomes',label:'Outcomes',question:'What outcomes were measured?'},
  {id:'results',label:'Results',question:'What principal results are reported? Preserve qualifications and do not imply causation from association.'},
  {id:'limitations',label:'Limitations',question:'What limitations do the authors explicitly report? Do not infer limitations.'},
] as const;
export const SNAPSHOT_COLUMNS = [...SNAPSHOT_FIELDS, {id:'ai-summary',label:'AI Summary',question:'Give a concise overall paper summary supported entirely by the supplied source passages.'}];
export const SNAPSHOT_QUESTION = 'Create a study snapshot of this paper using only its available source text. Report missing information as Not reported. Never infer missing study details.';
export const snapshotWorkId = (paper:Paper) => paper.identifiers?.openalex || paper.providerId || '';

const evidenceSchema = z.object({
  id:z.string().min(1),claimId:z.string().min(1),documentId:z.string().min(1),passageId:z.string().min(1),
  text:z.string().min(15),sourceType:z.enum(['full_text','abstract']),page:z.number().int().positive().nullish(),
  startOffset:z.number().int().nonnegative(),endOffset:z.number().int().positive(),
});
const cellSchema = z.object({claimId:z.string().min(1),value:z.string(),status:z.enum(['supported','not_reported']),evidenceIds:z.array(z.string())});
const analysisSchema = z.object({documentId:z.string().min(1),question:z.literal(SNAPSHOT_QUESTION),sourceType:z.enum(['full_text','abstract','none']),model:z.string().min(1),cells:z.record(z.string(),cellSchema),evidence:z.array(evidenceSchema)});
export type SnapshotEvidence = z.infer<typeof evidenceSchema>;
export type SnapshotValue = {value:string;status:'supported'|'not_reported';claimId:string;evidence:SnapshotEvidence[]};
export type Snapshot = {workId:string;documentId:string;sourceType:'full_text'|'abstract';model:string;cells:Record<string,SnapshotValue>};
export type SnapshotUsage = {remaining:number|null;unlimited:boolean;refillAt:string|null;refillAmount:number|null};
export const UNKNOWN_USAGE:SnapshotUsage = {remaining:null,unlimited:false,refillAt:null,refillAmount:null};
/** Optional trusted capability payload. The server must enforce quotas; this is display state only. */
export function readSnapshotUsage(value:unknown):SnapshotUsage {
  const result=z.object({remaining:z.number().int().nonnegative().nullable(),unlimited:z.boolean(),refillAt:z.iso.datetime().nullable(),refillAmount:z.number().int().positive().nullable()}).safeParse(value);
  return result.success?result.data:UNKNOWN_USAGE;
}
export function normalizeSnapshot(workId:string,raw:unknown):Snapshot {
  const parsed=analysisSchema.safeParse(raw);
  if(!parsed.success)throw new Error('The Snapshot service returned an invalid response. Please retry.');
  const analysis=parsed.data;
  if(analysis.sourceType==='none')throw new Error('No usable abstract or full text is available for this paper. A Snapshot could not be generated.');
  const cells:Snapshot['cells']={};
  for(const field of SNAPSHOT_COLUMNS){
    const cell=analysis.cells[field.id];
    // Incomplete responses are failures, not successful empty snapshots to cache forever.
    if(!cell)throw new Error('The Snapshot was incomplete. Please retry.');
    const evidence=analysis.evidence.filter(e=>cell.evidenceIds.includes(e.id)&&e.claimId===cell.claimId&&e.documentId===analysis.documentId&&e.sourceType===analysis.sourceType&&e.endOffset-e.startOffset===e.text.length&&(e.sourceType==='abstract'||!!e.page));
    const supported=cell.status==='supported'&&!!cell.value.trim()&&evidence.length>0&&evidence.length===cell.evidenceIds.length;
    cells[field.id]={value:supported?cell.value:'Not reported',status:supported?'supported':'not_reported',claimId:cell.claimId,evidence:supported?evidence:[]};
  }
  return {workId,documentId:analysis.documentId,sourceType:analysis.sourceType,model:analysis.model,cells};
}
