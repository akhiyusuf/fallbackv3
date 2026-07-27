/**
 * M4 test-only helper — the QueryClientProvider wrapper every M4 screen test renders through.
 * Does NOT call `jest.mock` itself (those must live at the top of each test file so
 * babel-plugin-jest-hoist can hoist them ahead of the file's own imports — see
 * `src/queries/mutations.test.ts`'s header for the same constraint). Test files still need
 * their own three-line `jest.mock('@/db', ...)` / `expo-crypto` / `@/lib/date` block; this
 * file only removes the QueryClient-plumbing duplication.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: true },
      mutations: { retry: false },
    },
  });
}

export function withClient(client: QueryClient, children: React.ReactNode) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
