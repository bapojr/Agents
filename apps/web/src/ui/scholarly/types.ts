import type {Paper} from '../paper-data';

export type SearchFilters = {fromYear?: number; toYear?: number; publicationType?: string; author?: string};
export type SearchIntent = {originalQuery: string; searchText: string; filters: SearchFilters; notes: string[]};
export type ProviderPage = {papers: Paper[]; total: number; nextCursor?: string};
export type SearchPage = ProviderPage & {provider: string; intent: SearchIntent};
export interface ScholarlyProvider {
  id: string;
  name: string;
  search(intent: SearchIntent, signal: AbortSignal, cursor?: string): Promise<ProviderPage>;
}

export type SearchErrorCode = 'query' | 'timeout' | 'rate-limit' | 'unavailable' | 'network' | 'malformed' | 'access';
export class ScholarlySearchError extends Error {
  constructor(public code: SearchErrorCode, message: string) { super(message); this.name = 'ScholarlySearchError'; }
}
