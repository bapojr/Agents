/** One normalized record shared by search, citations, cards, reader and table. */
export type Evidence = { id: string; text: string; section: string; page?: number; rects?: number[][] };
export type Extraction = { value: string; evidence: string; sourceUrl: string };
export type Paper = {
  id: string; title: string; authors: string[]; shortAuthor: string; year?: number;
  journal: string; doi: string; url: string; type: string; summary: string; finding: string;
  limitation: string; fields: string[]; openAccess?: boolean; pdf?: string; pages?: number;
  evidence: Evidence[]; citationCount?: number; quartile?: string;
  provider?: string; sourceId?: string; abstract?: string; verified?: boolean;
  extractions?: Record<string, Extraction>;
};
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' ? v as Record<string, unknown> : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
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
export function normalizeCrossref(value: unknown): Paper | null {
  const v = record(value), doi = plainText(v.DOI), title = plainText(array(v.title)[0]);
  if (!title || !/^10\.\d{4,9}\/.+/i.test(doi)) return null;
  const authors = array(v.author).map(a => { const author = record(a); return plainText(author.name) || [plainText(author.given), plainText(author.family)].filter(Boolean).join(' '); }).filter(Boolean);
  const dates = record(v.published)['date-parts'];
  const year = array(array(dates)[0])[0];
  const abstract = plainText(v.abstract);
  const citationCount = v['is-referenced-by-count'];
  const id = `doi:${doi.toLowerCase()}`;
  return { id, doi, title, authors, shortAuthor: authors.length > 1 ? `${authors[0]} et al.` : authors[0] || '',
    year: typeof year === 'number' && Number.isInteger(year) && year > 0 ? year : undefined,
    journal: plainText(array(v['container-title'])[0]), type: plainText(v.type).replaceAll('-', ' '),
    url: `https://doi.org/${doi}`, provider: 'Crossref', sourceId: doi,
    citationCount: typeof citationCount === 'number' && citationCount >= 0 && Number.isFinite(citationCount) ? citationCount : undefined,
    abstract: abstract || undefined, summary: '', finding: '', limitation: '', fields: array(v.subject).map(plainText).filter(Boolean),
    // A deposited DOI is not evidence that a study/claim has been verified. License/link != confirmed OA.
    evidence: abstract ? [{id:`${id}:abstract`,text:abstract,section:'Publisher abstract'}] : [],
  };
}
export function mergePapers(current: Paper[], incoming: Paper[]): Paper[] {
  const byId = new Map(current.map(p => [p.id, p]));
  incoming.forEach(p => byId.set(p.id, p));
  return [...byId.values()];
}
export const SEARCH_PAGE_SIZE = 50;
export type SearchPage = { papers: Paper[]; total: number; nextCursor?: string };
export function parseSearchPage(value: unknown, cursor = '*'): SearchPage {
  const message = record(record(value).message);
  if (!Array.isArray(message.items) || typeof message['total-results'] !== 'number') throw new Error('The paper service returned an invalid response. Please try again.');
  const papers = mergePapers([], message.items.map(normalizeCrossref).filter((p): p is Paper => !!p));
  const next = message['next-cursor'];
  return {papers, total: message['total-results'], nextCursor: message.items.length === SEARCH_PAGE_SIZE && typeof next === 'string' && next !== cursor ? next : undefined};
}
export function searchUrl(query: string, cursor = '*'): string {
  const params = new URLSearchParams({'query.bibliographic': query, rows:String(SEARCH_PAGE_SIZE), cursor, sort:'score', order:'desc'});
  return `https://api.crossref.org/works?${params}`;
}
export async function searchPapers(query: string, signal: AbortSignal, cursor = '*', request: typeof fetch = fetch): Promise<SearchPage> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, {once:true});
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 25000);
  try {
    const response = await request(searchUrl(query, cursor), {signal: controller.signal, headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error(response.status === 429 ? 'The paper service is busy. Please wait a moment and retry.' : 'The paper service could not complete this search. Please retry.');
    return parseSearchPage(await response.json(), cursor);
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
export function abstractExcerpt(paper: Paper): string {
  const text = paper.abstract || '';
  if (text.length <= 500) return text;
  const end = text.lastIndexOf(' ', 500);
  return `${text.slice(0, end > 0 ? end : 500)}…`;
}
