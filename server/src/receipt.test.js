import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReceipt } from './receipt.js';

test('missing receipt -> entitlement_invalid, never a network call', async () => {
  let called = false;
  const result = await verifyReceipt({ platform: 'ios', receipt: '', fetchImpl: async () => { called = true; } });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'entitlement_invalid');
  assert.equal(called, false);
});

test('unknown platform -> entitlement_invalid', async () => {
  const result = await verifyReceipt({ platform: 'web', receipt: 'x', fetchImpl: async () => ({ ok: true }) });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'entitlement_invalid');
});

test('a 200 from the store verifier -> ok', async () => {
  const result = await verifyReceipt({ platform: 'ios', receipt: 'jws-token', fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.equal(result.ok, true);
});

test('a 410 (gone/expired) from the store verifier -> entitlement_expired', async () => {
  const result = await verifyReceipt({ platform: 'android', receipt: 'token', fetchImpl: async () => ({ ok: false, status: 410 }) });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'entitlement_expired');
});

test('a network failure resolves calmly to entitlement_invalid, never throws', async () => {
  const result = await verifyReceipt({
    platform: 'ios',
    receipt: 'token',
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'entitlement_invalid');
});

test('never persists the receipt anywhere — the function returns only a boolean + code', async () => {
  const result = await verifyReceipt({ platform: 'ios', receipt: 'super-secret-receipt-value', fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.deepEqual(Object.keys(result).sort(), ['ok']);
});
