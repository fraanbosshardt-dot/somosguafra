import type { Db } from './ledger';

// Fixed GETs only. No billing engine, response bodies, IDs or credential values leave this function.
export async function billingProviderProbe(db: Pick<Db, 'billingAgreement'>) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { ok: false, checks: [{ operation: 'configuration', status: 0 }] };
  const agreement = await db.billingAgreement.findFirst({ where: { providerRef: { not: null }, status: { in: ['pending', 'authorized', 'paused'] } }, orderBy: { createdAt: 'desc' }, select: { providerRef: true } });
  const checks: { operation: string; status: number; technicalHint?: string }[] = [];
  const read = async (operation: string, path: string) => {
    let status = 0;
    try {
      const response = await fetch(`https://api.mercadopago.com${path}`, { method: 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
      status = response.status;
      let technicalHint: string | undefined;
      if (status >= 400 && response.body) {
        // Bound the error body and publish only a fixed technical vocabulary, never raw provider text.
        const reader = response.body.getReader(); let text = '';
        while (text.length < 4096) { const {done,value}=await reader.read(); if(done) break; text+=new TextDecoder().decode(value).slice(0,4096-text.length); }
        await reader.cancel();
        try {
          const body=JSON.parse(text); const message=(String(body.message??'')+' '+String(body.error??'')).replaceAll(token,'').replaceAll(agreement?.providerRef??'\u0000','');
          const words=new Set('limit offset parameter parameters maximum minimum max min integer number numeric invalid required missing valid not supported exceeds greater less than between must be positive zero negative range too large small at least one filter filters pagination preapproval_id payment_id payer_id status search results found authorized payments invoice invoices no approved date start end begin_date end_date sort criteria bad request bad_request cannot and the is value values are'.split(' '));
          technicalHint=(message.toLowerCase().match(/[a-z0-9_]+/g)??[]).filter(w=>words.has(w)||(/limit|offset|pagination/.test(message)&&/^\d{1,3}$/.test(w))).slice(0,45).join(' ');
        } catch { /* No unstructured content leaves the probe. */ }
      } else await response.body?.cancel();
      checks.push({ operation, status, ...(technicalHint ? {technicalHint} : {}) });
      return status;
    } catch { /* Do not return error messages or provider data. */ }
    checks.push({ operation, status });
    return status;
  };
  if (!agreement?.providerRef) await read('merchant_identity', '/users/me');
  else if (!/^[a-zA-Z0-9_-]{1,100}$/.test(agreement.providerRef)) checks.push({operation:'invalid_local_reference',status:0});
  else {
    const id = encodeURIComponent(agreement.providerRef);
    const status = await read('agreement', `/preapproval/${id}`);
    if (status >= 200 && status < 300) {
      const searchStatus = await read('authorized_payment_search_limit100', `/authorized_payments/search?preapproval_id=${id}&offset=0&limit=100`);
      if (searchStatus === 400) await read('authorized_payment_search_limit20', `/authorized_payments/search?preapproval_id=${id}&offset=0&limit=20`);
      if (searchStatus === 400) await read('authorized_payment_search_default', `/authorized_payments/search?preapproval_id=${id}`);
    }
  }
  return { ok: checks.length > 0 && checks.every(c => c.status >= 200 && c.status < 300), checks };
}
