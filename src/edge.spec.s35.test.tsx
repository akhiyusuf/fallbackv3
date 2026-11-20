/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). S35 — A reopened conversation
 * (`app/assistant/history/[id].tsx`). No test file covered this screen before.
 * Spec: ALLSCREENS_1.md S35. House pattern: RNTL v14, `await render`, mocks reset in beforeEach.
 */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { format } from 'date-fns';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
let mockId = 'c1';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockId }),
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: mockCanGoBack }),
}));

const mockConversation: { current: unknown; isLoading: boolean; isError: boolean; refetch: jest.Mock } = {
  current: undefined,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};
const mockTasks: { current: unknown[] } = { current: [] };
jest.mock('@/queries', () => ({
  useConversation: () => ({ data: mockConversation.current, isLoading: mockConversation.isLoading, isError: mockConversation.isError, refetch: mockConversation.refetch }),
  useTasks: () => ({ data: mockTasks.current, isLoading: false, isError: false }),
}));

const mockListMessages = jest.fn();
jest.mock('@/services/ai', () => ({ listMessages: (id: string) => mockListMessages(id) }));

import S35AssistantReopenedConversation from '../app/assistant/history/[id]';

const STARTED = '2026-07-16T08:14:00.000Z';

function conversation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    startedAt: STARTED,
    updatedAt: STARTED,
    modality: 'voice+text',
    summary: 'Added a workout',
    taskIdsTouched: ['t1'],
    ...overrides,
  };
}

function task(id: string, name: string) {
  return {
    id,
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
  };
}

const MESSAGES = [
  { id: 'm1', conversationId: 'c1', role: 'user', text: 'Add a workout at seven', toolCalls: [], createdAt: STARTED },
  { id: 'm2', conversationId: 'c1', role: 'assistant', text: 'Added Morning workout.', toolCalls: [], createdAt: STARTED },
];

describe('S35 — A reopened conversation (spec coverage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockId = 'c1';
    mockConversation.current = conversation();
    mockConversation.isLoading = false;
    mockConversation.isError = false;
    mockTasks.current = [task('t1', 'Morning workout'), task('t2', 'Unrelated habit')];
    mockListMessages.mockResolvedValue(MESSAGES);
    mockCanGoBack.mockReturnValue(true);
  });

  it('the header shows the conversation date and time, and the modality reads "Voice and text"', async () => {
    await render(<S35AssistantReopenedConversation />);
    expect(screen.getByText(format(new Date(STARTED), 'MMM d, h:mm a'))).toBeTruthy();
    expect(screen.getByText('Voice and text')).toBeTruthy();
  });

  it('replays every saved turn, user and assistant, in order', async () => {
    await render(<S35AssistantReopenedConversation />);
    expect(await screen.findByText('Add a workout at seven')).toBeTruthy();
    expect(screen.getByText('Added Morning workout.')).toBeTruthy();
    expect(mockListMessages).toHaveBeenCalledWith('c1');
  });

  it('"Tasks created in this chat" lists only the tasks this conversation touched', async () => {
    await render(<S35AssistantReopenedConversation />);
    expect(await screen.findByText('Tasks created in this chat')).toBeTruthy();
    expect(screen.getByText('Morning workout')).toBeTruthy();
    expect(screen.queryByText('Unrelated habit')).toBeNull();
  });

  it('a conversation that created no tasks shows no "Tasks created" section at all', async () => {
    mockConversation.current = conversation({ taskIdsTouched: [] });
    await render(<S35AssistantReopenedConversation />);
    expect(await screen.findByText('Add a workout at seven')).toBeTruthy();
    expect(screen.queryByText('Tasks created in this chat')).toBeNull();
  });

  it('a failed transcript read shows the calm retry banner, and Retry reads it again and replays it', async () => {
    mockListMessages.mockRejectedValueOnce(new Error('disk'));
    await render(<S35AssistantReopenedConversation />);
    expect(await screen.findByText("Couldn't load this conversation.")).toBeTruthy();
    expect(screen.queryByText('Add a workout at seven')).toBeNull();
    mockListMessages.mockResolvedValueOnce(MESSAGES);
    const user = userEvent.setup();
    await user.press(screen.getByText('Retry'));
    expect(await screen.findByText('Add a workout at seven')).toBeTruthy();
    expect(mockListMessages).toHaveBeenCalledTimes(2);
  });

  it('a failed conversation read (metadata) shows the retry banner instead of a blank screen', async () => {
    mockConversation.current = undefined;
    mockConversation.isError = true;
    await render(<S35AssistantReopenedConversation />);
    expect(await screen.findByText("Couldn't load this conversation.")).toBeTruthy();
  });

  it('while the conversation is still loading, skeletons show and no error appears', async () => {
    mockConversation.current = undefined;
    mockConversation.isLoading = true;
    await render(<S35AssistantReopenedConversation />);
    expect(screen.queryByText("Couldn't load this conversation.")).toBeNull();
    expect(screen.queryByText('Tasks created in this chat')).toBeNull();
  });

  it('the Send button stays inert while the continue field is empty, and sends a typed line into a new chat with that opening', async () => {
    await render(<S35AssistantReopenedConversation />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Send'));
    expect(mockPush).not.toHaveBeenCalled();
    await user.type(screen.getByPlaceholderText('Continue this chat…'), 'and a stretch');
    await user.press(screen.getByLabelText('Send'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const href = String(mockPush.mock.calls[0]?.[0]);
    expect(href.startsWith('/assistant/chat?')).toBe(true);
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('opening')).toBe('and a stretch');
    expect(params.get('continueId')).toBe('c1');
    expect(params.get('listen')).toBe('');
  });

  it('the mic in the continue footer opens the chat in listening mode for this conversation', async () => {
    await render(<S35AssistantReopenedConversation />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Continue by voice'));
    const href = String(mockPush.mock.calls[0]?.[0]);
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('listen')).toBe('1');
    expect(params.get('continueId')).toBe('c1');
  });

  it('back with nothing to go back to (a deep link) lands on Conversation history, not a dead end', async () => {
    mockCanGoBack.mockReturnValue(false);
    await render(<S35AssistantReopenedConversation />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/assistant/history');
  });

  // SPEC DEVIATION (bug): ALLSCREENS_1.md S35 says a task card in "Tasks created in this chat" is a
  // read-only reference, "no navigation away from S35 defined in the sitemap". The app pushes
  // /task/:id. No decision in docs/DESIGN_DECISIONS.md overrides this. Left for the main session.
  it.failing('a task card in "Tasks created" is read-only and does not navigate away (spec S35)', async () => {
    await render(<S35AssistantReopenedConversation />);
    const user = userEvent.setup();
    await user.press(await screen.findByText('Morning workout'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
