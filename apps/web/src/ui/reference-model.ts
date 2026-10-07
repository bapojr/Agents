import { abstractExcerpt, type Paper } from './paper-data';
export const FREE_TABULAR_REFERENCE_LIMIT = 20;
export type Entitlements = { tabularReferenceLimit: number; canExport: boolean };
export const FREE_ENTITLEMENTS: Entitlements = Object.freeze({tabularReferenceLimit:FREE_TABULAR_REFERENCE_LIMIT,canExport:false});
/** Replace with a trusted backend entitlement response; no local upgrade/payment simulation. */
export function referencePartition(items: Paper[], entitlements: Entitlements = FREE_ENTITLEMENTS) {
  const limit = Math.max(0, Math.floor(entitlements.tabularReferenceLimit));
  return {table:items.slice(0,limit),standard:items.slice(limit),showUpgrade:items.length>limit};
}
export function requestReferenceExport(entitlements: Entitlements, upgrade: () => void, exportData: () => void) {
  if (!entitlements.canExport) { upgrade(); return false; }
  exportData(); return true;
}
export type ReferenceColumn = {id:string;label:string;group:'suggested'|'default'|'saved';question?:string};
export const REFERENCE_COLUMNS: ReferenceColumn[] = [
  {id:'dimension',label:'Link',group:'suggested'},
  {id:'evidenceType',label:'Evidence Type',group:'suggested'},
  {id:'pathway',label:'Pathway',group:'suggested'},
  {id:'relevance',label:'Relevance',group:'suggested'},
  {id:'summary',label:'Summary',group:'suggested'},
  ...['Sample size','Objective','Population','Setting and timeframe','Outcomes measured','Conclusions','Limitations','Feasibility and costs'].map(label=>({id:label.toLowerCase().replaceAll(' ','-'),label,group:'default' as const})),
];
export const DEFAULT_COLUMN_IDS = REFERENCE_COLUMNS.filter(c=>c.group==='suggested').map(c=>c.id);
export function columnValue(paper: Paper, column: ReferenceColumn): {text:string;evidence?:string;url?:string} {
  const extraction = paper.extractions?.[column.id];
  if (extraction?.value && extraction.evidence && /^https?:\/\//.test(extraction.sourceUrl)) return {text:extraction.value,evidence:extraction.evidence,url:extraction.sourceUrl};
  if (column.id === 'evidenceType' && paper.type) return {text:`Publication type: ${paper.type}`};
  if (column.id === 'dimension' && paper.fields.length) return {text:paper.fields.join(', ')};
  if (column.id === 'summary' && paper.abstract) return {text:`Abstract excerpt: ${abstractExcerpt(paper)}`,evidence:paper.abstract,url:paper.url};
  return {text:'Not extracted'};
}
export function addReferenceColumn(columns: ReferenceColumn[], name: string, question: string): ReferenceColumn[] {
  const label = name.trim(), prompt = question.trim();
  if (!label) throw new Error('Enter a column name.');
  if (columns.some(c=>c.label.toLowerCase()===label.toLowerCase())) throw new Error('A column with this name already exists.');
  return [...columns,{id:`custom:${crypto.randomUUID()}`,label,question:prompt,group:'saved'}];
}
