import { expect, it } from 'vitest';
import { BillingProviderHttpError, billingFailureMetadata } from '@/server/billing-failure';
import { UserError } from '@/server/ledger';
it('retains only HTTP classification, without reference/query/token details', () => {
  const error = new BillingProviderHttpError(403, '/authorized_payments/search?preapproval_id=private-reference&token=private-secret');
  expect(error).toBeInstanceOf(UserError);
  expect(billingFailureMetadata(error)).toEqual({httpStatus:403,operation:'authorized_payment_search',method:'GET'});
  expect(JSON.stringify(error)).not.toContain('private-');
  expect(error.message).not.toContain('private-');
  expect(billingFailureMetadata(new Error('secret'))).toEqual({});
});
it('limits paths and methods to known technical labels', () => {
  expect(billingFailureMetadata(new BillingProviderHttpError(404,'/preapproval/private-id','GET'))).toEqual({httpStatus:404,operation:'agreement',method:'GET'});
  expect(billingFailureMetadata(new BillingProviderHttpError(401,'/other/private-id','secret'))).toEqual({httpStatus:401,operation:'other',method:'other'});
});
