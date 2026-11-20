/**
 * Browser round 3 (review 33): tapping Save on a form with an error showed the message only
 * next to the field, which on a phone is often below the fold, so Save looked dead. A toast
 * now says there is something to fix.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));

import React from 'react';
import { renderRouter, screen } from 'expo-router/testing-library';
import { userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { useToastStore } from '@/app-shell/stores/toast';
import { FIX_FIELDS } from '@/features/task/formShared';

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  fake.reset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  useToastStore.setState({ toast: null });
});

describe('invalid Save shows a toast', () => {
  it.each([
    ['/add/routine', 'Save routine'],
    ['/add/todo', /^Save/],
    ['/add/course', 'Save course'],
    ['/add/event', 'Save event'],
  ])('%s', async (url, label) => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: url, wrapper });
    await userEvent.press(await screen.findByLabelText(label));
    expect(useToastStore.getState().toast?.message).toBe(FIX_FIELDS);
  });
});
