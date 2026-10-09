import {auth} from '@/auth';
import {env} from '@/lib/env';
import {boundedJson} from '@/lib/http';
import {allowAttempt} from '@/lib/rate-limit';
export const runtime='nodejs';

/** Authenticated BFF. The internal service token and model keys never reach the browser. */
async function proxy(request:Request,context:{params:Promise<{path:string[]}>}):Promise<Response>{
  const origin=request.headers.get('origin');
  const allowed=[new URL(env().APP_ORIGIN).origin,process.env.PAGES_ORIGIN].filter(Boolean);
  const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&allowed.includes(origin)){
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Credentials']='true';
  }
  const fail=(error:string,status:number)=>Response.json({error},{status,headers});
  if(origin&&!allowed.includes(origin))return fail('Origin not allowed',403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  if(request.method==='POST'&&!origin)return fail('Origin required',403);
  const session=await auth();
  if(!session?.user?.id)return fail('Sign in on the research backend to analyse documents.',401);
  const {path}=await context.params;
  const route=path.join('/');
  if(!/^(capabilities|extract|documents\/W\d+(\/pages\/[1-9]\d?)?)$/.test(route))return fail('Not found',404);
  if((request.method==='POST')!==(route==='extract'))return fail('Method not allowed',405);
  if(!await allowAttempt(request.method==='POST'?'extraction':'documents',session.user.id,request.method==='POST'?20:120,3600))return fail('Document processing limit reached. Please retry later.',429);
  const service=process.env.RESEARCH_SERVICE_URL,token=process.env.RESEARCH_INTERNAL_TOKEN;
  if(!service||!token)return fail('The live document service is not configured.',503);
  let body:string|undefined;
  if(request.method==='POST'){
    try{body=JSON.stringify(await boundedJson(request,20000));}
    catch{return fail('A valid JSON request of at most 20 KB is required.',400);}
  }
  try{
    const query=new URLSearchParams();
    if(new URL(request.url).searchParams.get('retry')==='true')query.set('retry','true');
    const version=new URL(request.url).searchParams.get('version');
    if(version&&/^[a-f0-9]{32}$/.test(version))query.set('version',version);
    const retry=query.size?'?'+query.toString():'';
    const upstream=await fetch(`${service.replace(/\/$/,'')}/evidence/${route}${retry}`,{
      method:request.method,body,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},
      signal:AbortSignal.timeout(240000),cache:'no-store'});
    return new Response(upstream.body,{status:upstream.status,headers:{...headers,
      'Content-Type':upstream.headers.get('content-type')||'application/json','X-Content-Type-Options':'nosniff'}});
  }catch{return fail('The document service could not complete this request. Please retry.',502);}
}
export const GET=proxy;
export const POST=proxy;
export const OPTIONS=proxy;
