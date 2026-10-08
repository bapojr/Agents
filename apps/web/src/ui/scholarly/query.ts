import {ScholarlySearchError, type SearchFilters, type SearchIntent} from './types';

/** Conservative retrieval cleanup only: no invented synonyms, claims, or papers. */
export function processResearchQuery(originalQuery: string, currentYear = new Date().getFullYear()): SearchIntent {
  let text = originalQuery.trim().replace(/[’‘]/g, "'");
  if (!text) throw new ScholarlySearchError('query', 'Enter a research question.');
  const filters: SearchFilters = {};
  const notes: string[] = [];
  const year = '(1[5-9]\\d{2}|20\\d{2}|21\\d{2})';
  text = text.replace(new RegExp(`\\b(?:published\\s+)?between\\s+${year}\\s+(?:and|to|–|-)\\s+${year}\\b`, 'i'), (_, from, to) => {
    filters.fromYear = +from; filters.toYear = +to; return ' ';
  });
  text = text.replace(new RegExp(`\\b(?:published\\s+)?(since|after|before|until|through)\\s+${year}\\b`, 'gi'), (_, operator: string, value: string) => {
    const n = +value;
    if (/since|after/i.test(operator)) filters.fromYear = n + (/after/i.test(operator) ? 1 : 0);
    else filters.toYear = n - (/before/i.test(operator) ? 1 : 0);
    return ' ';
  });
  text = text.replace(new RegExp(`\\bpublished\\s+in\\s+${year}\\b`, 'i'), (_, value) => {
    filters.fromYear = +value; filters.toYear = +value; return ' ';
  });
  text = text.replace(/\b(?:in\s+the\s+)?(?:last|past)\s+(\d{1,2})\s+years?\b/i, (_, n) => {
    if (+n < 1) throw new ScholarlySearchError('query', 'Use a positive number of years.');
    filters.fromYear = currentYear - +n + 1; filters.toYear = currentYear; return ' ';
  });
  text = text.replace(/\b(recent|latest)\s+(papers|studies|articles|research|publications)\b/gi, () => {
    if (filters.fromYear === undefined && filters.toYear === undefined) {
      filters.fromYear = currentYear - 4; filters.toYear = currentYear;
      notes.push('Recent means the last 5 publication years.');
    }
    return ' ';
  });
  if (filters.fromYear !== undefined && filters.toYear !== undefined && filters.fromYear > filters.toYear) {
    throw new ScholarlySearchError('query', 'The publication year range is invalid.');
  }
  // Match explicit author requests, not phrases such as "caused by air pollution".
  text = text.replace(/\b(?:papers|studies|articles|publications|research)\s+(?:written\s+)?by\s+("[^"]+"|[\p{L}\p{M}.' -]+?)(?=\s+(?:on|about|regarding)\b|[?!]?$)/iu, (_, name: string) => {
    filters.author = name.replaceAll('"', '').trim(); return ' ';
  });
  if (/\b(?:systematic\s+)?reviews?\s+(?:on|of|about|regarding)\b/i.test(text)) {
    filters.publicationType = 'review';
    // Keep "systematic" as a search term: OpenAlex's review type is broader.
    text = text.replace(/\breviews?\b/i, ' ');
  }
  text = text.replace(/^\s*(?:please\s+)?(?:find|show(?:\s+me)?|search(?:\s+for)?|give\s+me|list)\s+/i, '')
    .replace(/^(?:what\s+does\s+research\s+say\s+about|how\s+does|how\s+do|does|do|did|what\s+is|what\s+are|is|are|can|could)\s+/i, '')
    .replace(/\b(?:papers|studies|articles|research)\s+(?:on|about|regarding|comparing)\b/gi, ' ')
    .replace(/\b(?:effects?\s+of|impact\s+of|relationship\s+between)\b/gi, ' ')
    .replace(/[?!]/g, ' ').replace(/\s+/g, ' ').trim();
  // OpenAlex handles stemming and stop words. Preserve scientific terms and negation.
  if (!text && !filters.author && !filters.fromYear && !filters.publicationType) {
    throw new ScholarlySearchError('query', 'Add a research topic to search.');
  }
  if (encodeURIComponent(text).length > 2800) throw new ScholarlySearchError('query', 'Please shorten this research question before searching.');
  if (filters.fromYear || filters.toYear) notes.push(`Publication years: ${filters.fromYear || 'any'}–${filters.toYear || 'present'}.`);
  if (filters.publicationType) notes.push('Publication type: review.');
  if (filters.author) notes.push(`Author byline: ${filters.author}.`);
  return {originalQuery, searchText: text, filters, notes};
}
