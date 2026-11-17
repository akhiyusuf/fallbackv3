/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
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
    // The badge text ("3 tasks") and the modality ("Voice and text") are the two parts of the row's
    // single meta line, in the order the spec gives them.
    expect(screen.getByText(/Voice and text · 3 tasks/)).toBeTruthy();
  });

  it('tapping a conversation row opens that conversation (S35)', async () => {
    mockConversations.current = [
      { id: 'c1', startedAt: '2026-07-27T08:14:00.000Z', updatedAt: '2026-07-27T08:14:00.000Z', modality: 'text', summary: 'Built 5 dinners as a 5-day course', taskIdsTouched: ['t1'] },
    ];
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await renderScreen();
    await userEvent.press(await screen.findByText('Built 5 dinners as a 5-day course'));
    expect(push).toHaveBeenCalledWith('/assistant/history/c1');
    push.mockRestore();
  });
});
