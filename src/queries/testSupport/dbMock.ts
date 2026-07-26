/**
 * M2 — the single fake-repos instance a test file mocks `@/db` onto via
 * `jest.mock('@/db', () => require('./testSupport/dbMock'))`. Import `fake` alongside
 * `repos` in the test file itself to seed/inspect the same underlying store.
 */
import { createFakeRepos } from './fakeRepos';

export const fake = createFakeRepos();
export const repos = fake.repos;
export const store = {
  open: async () => ({ ok: true as const, value: 'ready' as const }),
  status: () => 'ready' as const,
  eraseAll: async () => ({ ok: true as const, value: undefined }),
  backup: async () => ({ ok: true as const, value: { uri: '', createdAt: '2024-01-01T00:00:00.000Z' } }),
  restore: async () => ({ ok: true as const, value: undefined }),
};
