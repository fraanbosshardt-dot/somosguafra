import { UserError } from './ledger';

// Never retain provider bodies, URLs, IDs, headers or tokens in diagnostics.
export class BillingProviderHttpError extends UserError {
  readonly httpStatus: number;
  readonly operation: string;
  readonly method: string;
  constructor(status: number, path: string, method = 'GET') {
    super('Mercado Pago no respondió. Probá de nuevo en un momento.');
    this.httpStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 0;
    this.method = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method) ? method : 'other';
    const pathname = path.split('?')[0];
    this.operation = pathname === '/authorized_payments/search' ? 'authorized_payment_search'
      : pathname === '/preapproval/search' ? 'agreement_search'
      : /^\/preapproval(?:\/[^/]+)?$/.test(pathname) ? 'agreement'
      : /^\/authorized_payments\/[^/]+$/.test(pathname) ? 'authorized_payment'
      : /^\/v1\/payments\/[^/]+$/.test(pathname) ? 'payment' : 'other';
  }
}

export function billingFailureMetadata(error: unknown) {
  return error instanceof BillingProviderHttpError
    ? { httpStatus: error.httpStatus, operation: error.operation, method: error.method }
    : {};
}
