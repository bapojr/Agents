import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),rate:vi.fn()}));
vi.mock('../src/auth',()=>({auth:mocks.auth}));
vi.mock('../src/lib/env',()=>({env:()=>({APP_ORIGIN:'https://agents.example'})}));
vi.mock('../src/lib/rate-limit',()=>({allowAttempt:mocks.rate}));
import {GET,POST} from '../src/app/api/evidence/[...path]/route';
const context=(...path:string[])=>({params:Promise.resolve({path})});
beforeEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();mocks.auth.mockResolvedValue(null);mocks.rate.mockResolvedValue(true);});
describe('protected evidence proxy',()=>{
 it('requires a real signed-in user',async()=>{const r=await GET(new Request('https://agents.example/api/evidence/capabilities'),context('capabilities'));expect(r.status).toBe(401);});
 it('rejects another origin before authorization or processing',async()=>{const r=await POST(new Request('https://agents.example/api/evidence/extract',{method:'POST',headers:{Origin:'https://attacker.example'}}),context('extract'));expect(r.status).toBe(403);});
 it('never accepts arbitrary upstream URLs',async()=>{mocks.auth.mockResolvedValue({user:{id:'u1'}});const r=await GET(new Request('https://agents.example/api/evidence/anything'),context('https:','localhost'));expect(r.status).toBe(404);});
 it('injects the service credential only server-side',async()=>{mocks.auth.mockResolvedValue({user:{id:'u1'}});vi.stubEnv('RESEARCH_SERVICE_URL','http://research:8000');vi.stubEnv('RESEARCH_INTERNAL_TOKEN','test-only-secret');const fetch=vi.fn().mockResolvedValue(Response.json({documents:true,extraction:false}));vi.stubGlobal('fetch',fetch);const r=await GET(new Request('https://agents.example/api/evidence/capabilities'),context('capabilities'));expect(r.status).toBe(200);expect(fetch.mock.calls[0][0]).toBe('http://research:8000/evidence/capabilities');expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only-secret');expect(await r.text()).not.toContain('test-only-secret');});
});
