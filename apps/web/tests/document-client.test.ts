import {afterEach,expect,it,vi} from 'vitest';
import type {Paper} from '../src/ui/paper-data';

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules();});

it('loads public PDF metadata without credentials or enabling AI on Pages',async()=>{
  vi.stubEnv('NEXT_PUBLIC_BASE_PATH','/Agents');
  vi.stubEnv('NEXT_PUBLIC_RESEARCH_API_URL','');
  vi.stubEnv('NEXT_PUBLIC_DOCUMENT_API_URL','https://documents.example');
  vi.resetModules();
  const fetch=vi.fn().mockResolvedValue(Response.json({id:'real-document-id'}));
  vi.stubGlobal('fetch',fetch);
  const client=await import('../src/ui/evidence/client');
  expect(client.evidenceConfigured).toBe(false);
  await client.loadDocument({providerId:'W123'} as Paper);
  expect(fetch.mock.calls[0][0]).toBe('https://documents.example/documents/W123');
  expect(fetch.mock.calls[0][1].credentials).toBe('omit');
  expect(client.documentUrl('documents/W123/pages/1')).toBe('https://documents.example/documents/W123/pages/1');
  await expect(client.evidenceRequest('extract',{})).rejects.toThrow('connected research backend');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('keeps authenticated document requests when no public PDF service is configured',async()=>{
  vi.stubEnv('NEXT_PUBLIC_BASE_PATH','/Agents');
  vi.stubEnv('NEXT_PUBLIC_DOCUMENT_API_URL','');
  vi.stubEnv('NEXT_PUBLIC_RESEARCH_API_URL','https://research.example/api/evidence');
  vi.resetModules();
  const fetch=vi.fn().mockResolvedValue(Response.json({id:'real-document-id'}));
  vi.stubGlobal('fetch',fetch);
  const client=await import('../src/ui/evidence/client');
  await client.loadDocument({providerId:'W123'} as Paper);
  expect(fetch.mock.calls[0][0]).toBe('https://research.example/api/evidence/documents/W123');
  expect(fetch.mock.calls[0][1].credentials).toBe('include');
});
