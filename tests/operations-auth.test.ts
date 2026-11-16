import {afterEach, expect, it, vi} from 'vitest';
import {cronAuthorized, operationsAuthorized} from '@/lib/cron-auth';
const request = (token?: string) => new Request('https://example.invalid/api/health/operaciones', {headers: token ? {authorization: `Bearer ${token}`} : {}});
afterEach(() => vi.unstubAllEnvs());
it('the read-only monitor key cannot authorize jobs or missing/forged credentials', () => {
  vi.stubEnv('CRON_SECRET', 'cron-only-fixture');
  vi.stubEnv('OPERATIONS_MONITOR_SECRET', 'monitor-only-fixture-32-characters-long');
  expect(operationsAuthorized(request('monitor-only-fixture-32-characters-long'))).toBe(true);
  expect(cronAuthorized(request('monitor-only-fixture-32-characters-long'))).toBe(false);
  expect(operationsAuthorized(request())).toBe(false);
  expect(operationsAuthorized(request('forged'))).toBe(false);
  expect(operationsAuthorized(request('cron-only-fixture'))).toBe(true);
});
it('fails closed with missing or weak monitor configuration', () => {
  vi.stubEnv('CRON_SECRET', '');
  vi.stubEnv('OPERATIONS_MONITOR_SECRET', '');
  expect(operationsAuthorized(request())).toBe(false);
  vi.stubEnv('OPERATIONS_MONITOR_SECRET', 'short');
  expect(operationsAuthorized(request('short'))).toBe(false);
});
