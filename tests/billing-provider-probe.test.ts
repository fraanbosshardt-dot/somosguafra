import {afterEach,expect,it,vi} from 'vitest';
import {billingProviderProbe} from '@/server/billing-provider-probe';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('uses only fixed GETs and returns codes without exposing bodies, keys or references',async()=>{
  vi.stubEnv('MP_ACCESS_TOKEN','private-token');
  const fetchMock=vi.fn(async (_url:string, init:any)=>{expect(init.method).toBe('GET');return Response.json({private:'customer-data'},{status:fetchMock.mock.calls.length===2?400:200});});
  vi.stubGlobal('fetch',fetchMock);
  const db:any={billingAgreement:{findFirst:async()=>({providerRef:'private-reference'})}};
  const result=await billingProviderProbe(db);
  expect(result.checks.map(c=>c.status)).toEqual([200,400,200]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(result)).not.toMatch(/private-|customer-data/);
});
it('does not search payments when agreement authentication fails',async()=>{
  vi.stubEnv('MP_ACCESS_TOKEN','private-token');
  const fetchMock=vi.fn(async()=>new Response('private-provider-error',{status:403}));vi.stubGlobal('fetch',fetchMock);
  expect(await billingProviderProbe({billingAgreement:{findFirst:async()=>({providerRef:'ref'})}} as any)).toEqual({ok:false,checks:[{operation:'agreement',status:403}]});
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('fails closed without credentials',async()=>{
  vi.stubEnv('MP_ACCESS_TOKEN',''); const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  expect((await billingProviderProbe({} as any)).ok).toBe(false);expect(fetchMock).not.toHaveBeenCalled();
});
