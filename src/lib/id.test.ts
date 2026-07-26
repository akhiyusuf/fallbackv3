/**
 * `jest-expo`'s auto-generated mock for `expo-crypto` (`expo-crypto/mocks/ExpoCrypto.ts`)
 * stubs `randomUUID()` to return `undefined` — there is no real UUID generator under Jest
 * (no native binary). This file supplies its own local mock so `newId()` is exercised
 * against a realistic implementation without reaching into any shared/root-level mock path.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      const hex = counter.toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${hex}`;
    }),
  };
});

import { newId } from './id';

describe('newId', () => {
  it('returns a UUIDv4-shaped, non-empty string', () => {
    const id = newId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates distinct ids across calls', () => {
    expect(newId()).not.toBe(newId());
  });
});
