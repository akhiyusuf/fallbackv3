/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { useToastStore } from '@/app-shell';
import type { Id, LocalDate } from '@/types';

const mockPreview: { current: { now: number | null; ifSkipped: number | null } | undefined } = { current: undefined };
const mockMarkOff = jest.fn();
jest.mock('@/queries', () => ({
  useSkipPreview: (target: unknown) => ({ data: target ? mockPreview.current : undefined }),
  useMarkOffDay: () => ({ mutateAsync: mockMarkOff }),
}));
jest.mock('@/services/sfx', () => ({ play: jest.fn() }));

import { SKIP_COPY, SkipSheetHost } from './SkipSheetHost';
import { useSkipSheetStore } from './skipSheet';

async function ask(onSkip = jest.fn()) {
  await act(async () => useSkipSheetStore.getState().ask({ taskId: 't1' as Id, name: 'Morning workout', date: '2026-11-17' as LocalDate, onSkip }));
  return onSkip;
}

describe('Skip sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSkipSheetStore.setState({ request: null });
    useToastStore.setState({ toast: null });
    mockPreview.current = { now: 78, ifSkipped: 76 };
    mockMarkOff.mockResolvedValue({ ok: true, value: undefined });
  });

  it('shows nothing until Skip is pressed somewhere', async () => {
    await render(<SkipSheetHost />);
    expect(screen.queryByText(SKIP_COPY.skipLabel)).toBeNull();
  });

  it('shows what a skip costs before the person commits', async () => {
    await render(<SkipSheetHost />);
    await ask();
    expect(await screen.findByText(SKIP_COPY.title('Morning workout'))).toBeTruthy();
    expect(screen.getByLabelText('Consistency 78% now, 76% if skipped')).toBeTruthy();
    expect(screen.getByText(SKIP_COPY.skipCostPlain)).toBeTruthy();
  });

  it('when a skip would not move the number, the row says so in words', async () => {
    mockPreview.current = { now: 100, ifSkipped: 100 };
    await render(<SkipSheetHost />);
    await ask();
    expect(await screen.findByText(SKIP_COPY.skipCost(100, 100))).toBeTruthy();
    expect(screen.queryByLabelText(/if skipped/)).toBeNull();
  });

  it('Skip it logs the skip through the caller and closes', async () => {
    const user = userEvent.setup();
    await render(<SkipSheetHost />);
    const onSkip = await ask();
    await user.press(await screen.findByText(SKIP_COPY.skipLabel));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(useSkipSheetStore.getState().request).toBeNull();
    expect(mockMarkOff).not.toHaveBeenCalled();
  });

  it('Take today off marks that habit off for the day, logs no skip, and offers Undo', async () => {
    const user = userEvent.setup();
    await render(<SkipSheetHost />);
    const onSkip = await ask();
    await user.press(await screen.findByText(SKIP_COPY.offLabel));
    await waitFor(() => expect(mockMarkOff).toHaveBeenCalledWith({ date: '2026-11-17', taskId: 't1', mark: true }));
    expect(onSkip).not.toHaveBeenCalled();
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(SKIP_COPY.offToast));

    await act(async () => useToastStore.getState().toast?.action?.onPress());
    await waitFor(() => expect(mockMarkOff).toHaveBeenLastCalledWith({ date: '2026-11-17', taskId: 't1', mark: false }));
  });

  it('a failed day off says it could not save', async () => {
    mockMarkOff.mockResolvedValue({ ok: false, error: { code: 'UNKNOWN', message: 'x' } });
    const user = userEvent.setup();
    await render(<SkipSheetHost />);
    await ask();
    await user.press(await screen.findByText(SKIP_COPY.offLabel));
    await waitFor(() => expect(useToastStore.getState().toast?.tone).toBe('warning'));
  });
});
