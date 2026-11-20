/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). ALLSCREENS_1.md S32: "tap header close (X) shows
 * the recap state (summary of this conversation)". No test covered the recap or the two ways out
 * of it (empty chat leaves at once; a chat with created tasks shows the recap first).
 * House pattern: RNTL v14, mocks reset in beforeEach.
 */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockRecap: { current: { taskCards: unknown[]; editBanners: unknown[] } } = { current: { taskCards: [], editBanners: [] } };
jest.mock('@/features/assistant/useAssistantChat', () => ({
  useAssistantChat: () => ({
    items: [],
    isStreaming: false,
    offline: false,
    clarification: null,
    sendMessage: jest.fn(),
    resolveClarification: jest.fn(),
    dismissClarification: jest.fn(),
    retryLast: jest.fn(),
    recap: mockRecap.current,
  }),
}));

jest.mock('@/queries', () => ({
  useTasks: () => ({ data: [] }),
  useCreateTask: () => ({ mutateAsync: jest.fn() }),
  useUpdateTask: () => ({ mutateAsync: jest.fn() }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
  useLogState: () => ({ mutateAsync: jest.fn() }),
  useSettings: () => ({ data: { assistant: { language: 'en-US', voice: 'warm' } } }),
  useUpdateSettings: () => ({ mutateAsync: jest.fn(async () => ({ ok: true, value: undefined })) }),
}));
jest.mock('@/services/ai', () => ({
  getAssistantProvider: jest.fn(),
  appendMessage: jest.fn(async () => ({ ok: true, value: undefined })),
  upsertConversation: jest.fn(async () => ({ ok: true, value: undefined })),
  listMessages: jest.fn(async () => []),
}));
jest.mock('@/services/billing', () => ({ billing: { refreshEntitlement: jest.fn(async () => ({ ok: true, value: undefined })) } }));
jest.mock('expo-audio', () => ({ getRecordingPermissionsAsync: jest.fn(async () => ({ granted: false })) }));

import S32AssistantConversation from '../app/assistant/chat';
import { S32_COPY } from '@/features/assistant/copy';

function createdTask(name: string) {
  return {
    id: 'morning',
    kind: 'task-card',
    task: {
      id: 'morning',
      type: 'routine',
      name,
      note: null,
      icon: 'Repeat',
      color: 'forge-orange',
      isAsNeeded: false,
      cadence: { kind: 'daily' },
      importance: 'med',
      necessity: 'recommended',
      snoozable: true,
      isTracked: true,
      dosesPerDay: 1,
      idealSteps: [],
      fallbackSteps: [],
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

describe('S32 — closing the chat shows the recap (spec coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecap.current = { taskCards: [], editBanners: [] };
  });

  it('an empty chat leaves at once on close: no recap sheet, back is called', async () => {
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    jest.spyOn(router, 'canGoBack').mockReturnValue(true);
    await render(<S32AssistantConversation />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Back'));
    expect(screen.queryByText(S32_COPY.recapHeadline)).toBeNull();
    expect(back).toHaveBeenCalled();
    back.mockRestore();
  });

  it('a chat that created a task shows the recap first, listing what was made', async () => {
    mockRecap.current = { taskCards: [createdTask('Morning workout')], editBanners: [] };
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    await render(<S32AssistantConversation />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Back'));
    expect(await screen.findByText(S32_COPY.recapHeadline)).toBeTruthy();
    expect(screen.getByText(S32_COPY.recapFooter)).toBeTruthy();
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it('Done on the recap leaves the chat', async () => {
    mockRecap.current = { taskCards: [createdTask('Morning workout')], editBanners: [] };
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    jest.spyOn(router, 'canGoBack').mockReturnValue(true);
    await render(<S32AssistantConversation />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Back'));
    await user.press(screen.getByLabelText(S32_COPY.recapDone));
    expect(back).toHaveBeenCalled();
    back.mockRestore();
  });

  it('Done on the recap with nothing to go back to lands on the assistant home, not a dead end', async () => {
    mockRecap.current = { taskCards: [createdTask('Morning workout')], editBanners: [] };
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    jest.spyOn(router, 'canGoBack').mockReturnValue(false);
    await render(<S32AssistantConversation />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Back'));
    await user.press(screen.getByLabelText(S32_COPY.recapDone));
    expect(replace).toHaveBeenCalledWith('/assistant');
    replace.mockRestore();
  });
});
