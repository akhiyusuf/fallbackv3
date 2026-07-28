/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

// Architect CR-6: S36's voice/language selection persists through `useSettings` /
// `useUpdateSettings` (settings columns added in migration 4), so both belong in this mock.
const mockUpdateSettings = jest.fn(async () => ({ ok: true, value: undefined }));
const mockSettings: { current: { assistant: { language: string; voice: string } } } = {
  current: { assistant: { language: 'en-US', voice: 'warm' } },
};
jest.mock('@/queries', () => ({
  useTasks: () => ({ data: [] }),
  useCreateTask: () => ({ mutateAsync: jest.fn() }),
  useUpdateTask: () => ({ mutateAsync: jest.fn() }),
  useDeleteTask: () => ({ mutateAsync: jest.fn() }),
  useLogState: () => ({ mutateAsync: jest.fn() }),
  useSettings: () => ({ data: mockSettings.current }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettings }),
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
  listMessages: jest.fn(async () => []),
}));

const mockRefreshEntitlement = jest.fn(async () => ({ ok: true, value: undefined }));
jest.mock('@/services/billing', () => ({
  billing: { refreshEntitlement: () => mockRefreshEntitlement() },
}));

const mockGetRecordingPermissionsAsync = jest.fn(async () => ({ granted: false }));
jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: () => mockGetRecordingPermissionsAsync(),
}));

import S32AssistantConversation from './chat';
import { S32_COPY, S36_COPY } from '@/features/assistant/copy';

const DEFAULT_MOCK_SETTINGS = { assistant: { language: 'en-US', voice: 'warm' } };

describe('S32 — Assistant Conversation', () => {
  beforeEach(() => jest.clearAllMocks());
  // Review pass 1, non-blocking note 4: `mockSettings` is mutable cross-test state. Reset it
  // HERE, not on the last line of a test body — a failing assertion above would skip that
  // line and silently pollute every test added after it.
  afterEach(() => {
    mockSettings.current = DEFAULT_MOCK_SETTINGS;
  });

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

  it('B4 — an ENTITLEMENT_REQUIRED error mid-chat routes to the paywall, never renders "offline"', async () => {
    async function* entitlementErrorStream() {
      yield { type: 'error', code: 'ENTITLEMENT_REQUIRED', message: 'x' };
    }
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat: () => entitlementErrorStream(), capabilities: async () => ({ chat: true, transcription: true }) });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await render(<S32AssistantConversation />);
    await userEvent.type(screen.getByLabelText('Type your request'), 'add a run');
    await userEvent.press(screen.getByLabelText('Send'));
    await Promise.resolve();
    expect(push).toHaveBeenCalledWith('/assistant/paywall');
    expect(screen.queryByText(S32_COPY.offline)).toBeNull();
    push.mockRestore();
  });

  it('B11 — tapping the mic with permission denied navigates to S37 recovery, never enters "Listening…"', async () => {
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat: () => okStream(), capabilities: async () => ({ chat: true, transcription: true }) });
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    await render(<S32AssistantConversation />);
    await userEvent.press(screen.getByLabelText('Switch to voice'));
    expect(push).toHaveBeenCalledWith('/assistant/mic-primer?context=recovery');
    expect(screen.queryByText(S32_COPY.listening)).toBeNull();
    push.mockRestore();
  });

  it('B11 — tapping the mic with permission granted enters voice modality', async () => {
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat: () => okStream(), capabilities: async () => ({ chat: true, transcription: true }) });
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    await render(<S32AssistantConversation />);
    await userEvent.press(screen.getByLabelText('Switch to voice'));
    expect(await screen.findByText(S32_COPY.listening)).toBeTruthy();
  });

  it('CR-6 — S36 renders the PERSISTED voice, and changing it writes through useUpdateSettings', async () => {
    mockGetAssistantProvider.mockResolvedValue({ id: 'managed', streamChat: () => okStream(), capabilities: async () => ({ chat: true, transcription: true }) });
    // A value that is NOT the pre-CR-6 in-process default: if the sheet still seeded itself
    // from module state (or from the column default), this assertion fails.
    mockSettings.current = { assistant: { language: 'en-US', voice: 'calm' } };
    await render(<S32AssistantConversation />);
    await userEvent.press(screen.getByLabelText('More options'));
    await userEvent.press(await screen.findByText(S36_COPY.voiceAndLanguage));
    expect(await screen.findByLabelText('Voice, Calm')).toBeTruthy();

    await userEvent.press(screen.getByLabelText('Voice, Calm'));
    await userEvent.press(await screen.findByText('Direct'));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ assistant: { language: 'en-US', voice: 'direct' } });
  });
});
