/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockConversations: { current: unknown[] | undefined } = { current: undefined };
jest.mock('@/queries', () => ({
  useConversations: () => ({ data: mockConversations.current, isLoading: mockConversations.current === undefined, isError: false }),
}));

import S34AssistantConversationHistory from './index';
import { S34_COPY } from '@/features/assistant/copy';

function renderScreen() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <S34AssistantConversationHistory />
    </QueryClientProvider>,
  );
}

describe('S34 — Assistant Conversation History', () => {
  beforeEach(() => {
    mockConversations.current = undefined;
  });

  it('empty: no conversations yet -> EmptyState', async () => {
    mockConversations.current = [];
    await renderScreen();
    expect(await screen.findByText(S34_COPY.emptyHeadline)).toBeTruthy();
    expect(screen.getByText(S34_COPY.emptySubcopy)).toBeTruthy();
  });

  it('default: a populated list renders date/time, modality tag, summary and task-count badge', async () => {
    mockConversations.current = [
      {
        id: 'c1',
        startedAt: '2026-07-27T08:14:00.000Z',
        updatedAt: '2026-07-27T08:14:00.000Z',
        modality: 'voice+text',
        summary: 'Added a workout, a meditation course & a reminder to call mom',
        taskIdsTouched: ['t1', 't2', 't3'],
      },
    ];
    await renderScreen();
    expect(await screen.findByText('Added a workout, a meditation course & a reminder to call mom')).toBeTruthy();
    expect(screen.getByText('3 tasks')).toBeTruthy();
    expect(screen.getByText('Voice + text')).toBeTruthy();
  });
});
