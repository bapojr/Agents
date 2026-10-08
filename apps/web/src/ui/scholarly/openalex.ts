import {mergePapers, normalizeDoi, plainText, safeUrl, type Paper} from '../paper-data';
import {fetchScholarlyJSON} from './http';
import {ScholarlySearchError, type ProviderPage, type ScholarlyProvider, type SearchIntent} from './types';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const SCHOLARLY_PAGE_SIZE = 50;

/** Reconstruct the supplied word positions only; reject malformed/sparse indexes. */
export function reconstructAbstract(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const words = new Map<number, string>();
  for (const [word, positions] of Object.entries(value)) {
    if (!Array.isArray(positions) || !word.trim()) return;
    for (const position of positions) {
      if (!Number.isSafeInteger(position) || position < 0 || position > 50000 || words.has(position)) return;
      words.set(position, word);
    }
  }
  if (!words.size || !words.has(0) || !words.has(words.size - 1)) return;
  const ordered = Array.from({length:words.size}, (_,i) => words.get(i));
  if (ordered.some(word => word === undefined)) return;
  return plainText(ordered.join(' ')) || undefined;
}

export function normalizeOpenAlex(value: unknown): Paper | null {
  const work = record(value), recordUrl = safeUrl(work.id);
  if (!recordUrl || !/^https:\/\/openalex\.org\/W\d+$/i.test(recordUrl)) return null;
  const title = plainText(work.title || work.display_name);
  if (!title) return null;
  const providerId = recordUrl.split('/').at(-1)!;
  const ids = record(work.ids), doi = normalizeDoi(work.doi || ids.doi);
  const pmid = typeof ids.pmid === 'string' ? ids.pmid.match(/(?:pubmed\.ncbi\.nlm\.nih\.gov\/)?(\d+)\/?$/)?.[1] : undefined;
  const authors = array(work.authorships).map(a => plainText(record(record(a).author).display_name)).filter(Boolean);
  const primary = record(work.primary_location), bestOA = record(work.best_oa_location), oa = record(work.open_access);
  const landingPageUrl = safeUrl(primary.landing_page_url);
  const pdfUrl = safeUrl(bestOA.pdf_url) || safeUrl(primary.pdf_url);
  const abstract = reconstructAbstract(work.abstract_inverted_index);
  const topics = array(work.topics).map(t => plainText(record(t).display_name)).filter(Boolean);
  const concepts = array(work.concepts).map(c => plainText(record(c).display_name)).filter(Boolean);
  const fields = [...new Set(array(work.topics).map(t => plainText(record(record(t).field).display_name)).filter(Boolean))];
  const year = typeof work.publication_year === 'number' && Number.isInteger(work.publication_year) && work.publication_year > 0 ? work.publication_year : undefined;
  const date = typeof work.publication_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(work.publication_date) ? work.publication_date : undefined;
  const citationCount = typeof work.cited_by_count === 'number' && Number.isInteger(work.cited_by_count) && work.cited_by_count >= 0 ? work.cited_by_count : undefined;
  const id = doi ? `doi:${doi}` : `openalex:${providerId}`;
  return {
    id, provider:'OpenAlex', providerId, sourceId:providerId, doi:doi || '', title, authors,
    shortAuthor:authors.length > 1 ? `${authors[0]} et al.` : authors[0] || '',
    year, publicationDate:date, abstract, journal:plainText(record(primary.source).display_name),
    type:plainText(work.type), publicationType:plainText(work.type) || undefined,
    citationCount, openAccess:typeof oa.is_oa === 'boolean' ? oa.is_oa : undefined,
    openAccessUrl:safeUrl(oa.oa_url), landingPageUrl, pdfUrl, pdf:pdfUrl,
    url:doi ? `https://doi.org/${doi}` : landingPageUrl || recordUrl,
    fields, topics, concepts, summary:'', finding:'', limitation:'',
    identifiers:{openalex:providerId, ...(doi ? {doi} : {}), ...(pmid ? {pmid} : {})},
    sources:[{provider:'OpenAlex',providerId,recordUrl}], retrievedAt:new Date().toISOString(),
    evidence:abstract ? [{id:`${id}:abstract`,text:abstract,section:'Source abstract'}] : [],
  };
}

export function openAlexSearchUrl(intent: SearchIntent, cursor = '*'): string {
  const params = new URLSearchParams({per_page:String(SCHOLARLY_PAGE_SIZE),cursor});
  if (intent.searchText) params.set('search', intent.searchText);
  const filters: string[] = [];
  if (intent.filters.fromYear) filters.push(`from_publication_date:${intent.filters.fromYear}-01-01`);
  if (intent.filters.toYear) filters.push(`to_publication_date:${intent.filters.toYear}-12-31`);
  if (intent.filters.publicationType) filters.push(`type:${intent.filters.publicationType}`);
  if (intent.filters.author) {
    const name = intent.filters.author.replace(/["\\,:|+]/g, ' ').replace(/\s+/g,' ').trim();
    filters.push(`raw_author_name.search:"${name}"`);
  }
  if (filters.length) params.set('filter',filters.join(','));
  // OpenAlex's default text-search order is relevance, never citation count alone.
  if (!intent.searchText) params.set('sort','publication_date:desc');
  return `https://api.openalex.org/works?${params}`;
}

export function parseOpenAlexPage(value: unknown): ProviderPage {
  const data = record(value), meta = record(data.meta);
  if (!Array.isArray(data.results) || !Number.isSafeInteger(meta.count) || (meta.count as number) < 0 ||
      !(meta.next_cursor === null || meta.next_cursor === undefined || typeof meta.next_cursor === 'string')) {
    throw new ScholarlySearchError('malformed','The scholarly source returned an invalid response. Please retry.');
  }
  const papers = mergePapers([], data.results.map(normalizeOpenAlex).filter((p):p is Paper => !!p));
  if (data.results.length && !papers.length) throw new ScholarlySearchError('malformed','The scholarly source returned records without valid identifiers. Please retry.');
  return {papers,total:meta.count as number,nextCursor:data.results.length && typeof meta.next_cursor === 'string' ? meta.next_cursor : undefined};
}

export class OpenAlexProvider implements ScholarlyProvider {
  readonly id = 'openalex';
  readonly name = 'OpenAlex';
  constructor(private request: typeof fetch = fetch) {}
  async search(intent: SearchIntent, signal: AbortSignal, cursor?: string): Promise<ProviderPage> {
    return parseOpenAlexPage(await fetchScholarlyJSON(openAlexSearchUrl(intent,cursor),signal,this.request));
  }
}
