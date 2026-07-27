/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('@/queries', () => ({
  useTasks: () => ({ data: [] }),
  useCreateTask: () => ({ mutateAsync: jest.fn() }),
  useUpdateTask: () => ({ mutateAsync: jest.fn() }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
  useLogState: () => ({ mutateAsync: jest.fn() }),
}));

async function* offlineStream() {
  yield { type: 'error', code: 'NETWORK_UNAVAILABLE', message: 'x' };
}
async function* okStream() {
  yield { type: 'text-delta', delta: 'Done — created it 🌱' };
  yield { type: 'done', summary: 'ok' };
}

const mockGetAssistantProvider = jest.fn();
jest.mock('@/services/ai', () => ({
  getAssistantProvider: () => mockGetAssistantProvider(),
  appendMessage: jest.fn(async () => ({ ok: true, value: undefined })),
  upsertConversation: jest.fn(async () => ({ ok: true, value: undefined })),
}));

import S32AssistantConversation from './chat';
import { S32_COPY } from '@/features/assistant/copy';

describe('S32 — Assistant Conversation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offline: the footer becomes a calm InlineRetryBanner with "Add a task manually" escape hatch', async () => {
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat: () => offlineStream(), capabilities: async () => ({ chat: true, transcription: true }) });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S32AssistantConversation />);
    await userEvent.type(screen.getByLabelText('Type your request'), 'add a run');
    await userEvent.press(screen.getByLabelText('Send'));
    expect(await screen.findByText(S32_COPY.offline)).toBeTruthy();
    expect(screen.getByText(S32_COPY.addTaskManually)).toBeTruthy();

    await userEvent.press(screen.getByText(S32_COPY.addTaskManually));
    expect(replace).toHaveBeenCalledWith('/add');
    replace.mockRestore();
  });

  it('a successful reply renders in the transcript', async () => {
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat: () => okStream(), capabilities: async () => ({ chat: true, transcription: true }) });
    await render(<S32AssistantConversation />);
    await userEvent.type(screen.getByLabelText('Type your request'), 'add a run');
    await userEvent.press(screen.getByLabelText('Send'));
    expect(await screen.findByText(/Done — created it/)).toBeTruthy();
  });
});
