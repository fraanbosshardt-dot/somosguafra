import type { Db } from './ledger';

// Fixed GETs only. No billing engine, response bodies, IDs or credential values leave this function.
export async function billingProviderProbe(db: Pick<Db, 'billingAgreement'>) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { ok: false, checks: [{ operation: 'configuration', status: 0 }] };
  const agreement = await db.billingAgreement.findFirst({ where: { providerRef: { not: null }, status: { in: ['pending', 'authorized', 'paused'] } }, orderBy: { createdAt: 'desc' }, select: { providerRef: true } });
  const checks: { operation: string; status: number }[] = [];
  const read = async (operation: string, path: string) => {
    let status = 0;
    try {
      const response = await fetch(`https://api.mercadopago.com${path}`, { method: 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
      status = response.status;
      await response.body?.cancel();
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
    }
  }
  return { ok: checks.length > 0 && checks.every(c => c.status >= 200 && c.status < 300), checks };
}
