/** One normalized record shared by search, citations, cards, reader and table. */
export type Evidence = { id: string; text: string; section: string; page?: number; rects?: number[][]; claimId?:string; documentId?:string; passageId?:string; sourceType?:"abstract"|"full_text"; startOffset?:number; endOffset?:number };
export type Extraction = { value: string; evidence: string; sourceUrl: string; status?:"supported"|"not_reported"; claimId?:string; evidenceIds?:string[]; sourceType?:string };
export type Paper = {
  id: string; title: string; authors: string[]; shortAuthor: string; year?: number;
  journal: string; doi: string; url: string; type: string; summary: string; finding: string;
  limitation: string; fields: string[]; openAccess?: boolean; pdf?: string; pages?: number;
  evidence: Evidence[]; citationCount?: number; quartile?: string;
  provider?: string; sourceId?: string; abstract?: string; verified?: boolean;
  extractions?: Record<string, Extraction>;
  analysisStatus?: "loading"|"ready"|"failed"; analysisError?:string; analysisSource?:string;
  locations?: {pdfUrl?:string;landingPageUrl?:string;openAccess?:boolean;license?:string}[];
  providerId?: string; publicationDate?: string; publicationType?: string;
  openAccessUrl?: string; landingPageUrl?: string; pdfUrl?: string;
  topics?: string[]; concepts?: string[];
  identifiers?: {doi?: string; openalex?: string; pmid?: string; semanticScholar?: string};
  sources?: {provider: string; providerId: string; recordUrl: string}[];
  retrievedAt?: string;

};
export function plainText(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/<[^>]*>/g, ' ').replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => {
    const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n: string) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[n]!)).replace(/\s+/g, ' ').trim();
}
export function safeUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return;
  try { const url = new URL(v); if (['https:', 'http:'].includes(url.protocol)) return url.href; } catch { /* Unknown is absent. */ }
}
export function normalizeDoi(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  const doi = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase();
  return /^10\.\d{4,9}\/\S+$/i.test(doi) ? doi : undefined;
}
const titleKey = (p: Paper) => p.title.length >= 40 && p.year && p.authors[0]
  ? `${p.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')}|${p.year}|${p.authors[0].toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')}` : undefined;
function identityKeys(p: Paper): string[] {
  const doi = normalizeDoi(p.doi || p.identifiers?.doi);
  return [p.id, ...(doi ? [`doi:${doi}`] : []), ...Object.entries(p.identifiers || {}).filter(([, v]) => v).map(([k,v]) => `${k}:${v!.toLowerCase()}`), ...(p.sources || []).map(s => `${s.provider}:${s.providerId}`)];
}
/** Stable relevance order; IDs first, conservative title+year+author match last. */
export function mergePapers(current: Paper[], incoming: Paper[]): Paper[] {
  const papers: Paper[] = [], ids = new Map<string, number>(), titles = new Map<string, number>();
  for (const paper of [...current, ...incoming]) {
    const keys = identityKeys(paper), key = titleKey(paper);
    let index = keys.map(id => ids.get(id)).find(i => i !== undefined);
    if (index === undefined && key && titles.has(key)) {
      const candidate = papers[titles.get(key)!];
      const oldDoi = normalizeDoi(candidate.doi), newDoi = normalizeDoi(paper.doi);
      // Distinct valid DOIs can represent distinct versions; do not collapse them by title.
      if (!(oldDoi && newDoi && oldDoi !== newDoi)) index = titles.get(key);
    }
    if (index === undefined) { index = papers.length; papers.push(paper); }
    else {
      const previous = papers[index];
      const available = Object.fromEntries(Object.entries(paper).filter(([,v]) => v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length)));
      const sources = [...new Map([...(previous.sources || []), ...(paper.sources || [])].map(s => [`${s.provider}:${s.providerId}`,s])).values()];
      papers[index] = {...previous,...available,id:previous.id,identifiers:{...previous.identifiers,...paper.identifiers},sources} as Paper;
    }
    for (const id of keys) ids.set(id,index);
    if (key) titles.set(key,index);
  }
  return papers;
}
export function abstractExcerpt(paper: Paper): string {
  const text = paper.abstract || '';
  if (text.length <= 500) return text;
  const end = text.lastIndexOf(' ', 500);
  return `${text.slice(0, end > 0 ? end : 500)}…`;
}
