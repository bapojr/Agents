import {ScholarlySearchError} from './types';

export async function fetchScholarlyJSON(url: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, {once: true});
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
  try {
    const response = await request(url, {signal: controller.signal, credentials: 'omit', headers: {Accept: 'application/json'}});
    if (response.status === 429) throw new ScholarlySearchError('rate-limit', 'The scholarly source has reached its rate limit. Please wait and retry.');
    if ([401, 402, 403].includes(response.status)) throw new ScholarlySearchError('access', 'The scholarly source is not allowing this request. Please retry later.');
    if (response.status >= 500) throw new ScholarlySearchError('unavailable', 'The scholarly source is unavailable. Please retry.');
    if (!response.ok) throw new ScholarlySearchError('query', 'The scholarly source could not process this search. Try a shorter question or retry.');
    try { return await response.json(); }
    catch { throw new ScholarlySearchError('malformed', 'The scholarly source returned an unreadable response. Please retry.'); }
  } catch (error) {
    if (signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
    if (timedOut) throw new ScholarlySearchError('timeout', 'The scholarly search timed out. Please retry.');
    if (error instanceof ScholarlySearchError) throw error;
    throw new ScholarlySearchError('network', 'Could not reach the scholarly source. Check your connection and retry.');
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
