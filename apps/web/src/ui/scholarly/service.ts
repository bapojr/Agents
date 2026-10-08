import {mergePapers, type Paper} from '../paper-data';
import {OpenAlexProvider} from './openalex';
import {processResearchQuery} from './query';
import {ScholarlySearchError, type SearchFilters, type ScholarlyProvider, type SearchPage} from './types';

export const LIVE_SEARCH_ENABLED = true;
export const PRIMARY_SCHOLARLY_SOURCE = 'OpenAlex';
const primaryProvider = new OpenAlexProvider();

/** UI boundary. Adapters own provider URLs, normalization, ranking and pagination. No fallback data. */
export async function searchScholarlyPapers(query: string, options: {signal:AbortSignal; cursor?:string; filters?:SearchFilters}, provider: ScholarlyProvider = primaryProvider): Promise<SearchPage> {
  const intent = processResearchQuery(query);
  intent.filters = {...intent.filters,...options.filters};
  const queryKey = JSON.stringify([intent.searchText,intent.filters]);
  let cursor: string | undefined;
  if (options.cursor) {
    try {
      const saved = JSON.parse(options.cursor);
      if (saved.provider !== provider.id || saved.query !== queryKey || typeof saved.token !== 'string') throw new Error();
      cursor = saved.token;
    } catch { throw new ScholarlySearchError('query','This result page belongs to a different search. Retry the search.'); }
  }
  const page = await provider.search(intent,options.signal,cursor);
  if (page.papers.some(p => !p.providerId || !p.sources?.some(s => s.providerId === p.providerId))) {
    throw new ScholarlySearchError('malformed','A source record could not be verified against its provider identifier. Please retry.');
  }
  return {...page,papers:mergePapers([],page.papers),provider:provider.name,intent,
    nextCursor:page.nextCursor ? JSON.stringify({provider:provider.id,query:queryKey,token:page.nextCursor}) : undefined};
}

/** Future synthesis must resolve every cited ID against this exact retrieved set. */
export function resolveRetrievedCitations(ids: string[], papers: Paper[]): Paper[] {
  const references = new Map(papers.map(p => [p.id,p]));
  return ids.map(id => {
    const paper = references.get(id);
    if (!paper) throw new Error('Citation is not part of this search result set.');
    return paper;
  });
}
