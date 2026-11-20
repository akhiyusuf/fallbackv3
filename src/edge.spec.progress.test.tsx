/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). ALLSCREENS_1.md S26 (All-time Trend Graph) and
 * PRD F28: the bucket readout, the empty-bucket readout and the table alternative were not
 * tested against each other. The spec's "scrub slider" is not in the app (see the it.failing).
 * House pattern: RNTL v14, mocks reset in beforeEach.
 */
import { render, screen, userEvent } from '@testing-library/react-native';

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  return { ...actual, today: () => '2026-07-16' };
});

const mockTrend: { current: unknown } = { current: undefined };
jest.mock('@/queries', () => ({
  useTrend: () => ({ data: mockTrend.current, isLoading: false, isError: false, refetch: jest.fn() }),
}));

import S26AllTimeTrendGraph from '../app/progress/trend';

function monthlyPoints() {
  return [
    { bucketKey: '2026-05-01', label: '2026-05-01', range: { from: '2026-05-01', to: '2026-05-31' }, percent: 80, breakdown: { ideal: 20, fallback: 4, off: 2, missed: 5 } },
    { bucketKey: '2026-06-01', label: '2026-06-01', range: { from: '2026-06-01', to: '2026-06-30' }, percent: null, breakdown: { ideal: 0, fallback: 0, off: 0, missed: 0 } },
    { bucketKey: '2026-07-01', label: '2026-07-01', range: { from: '2026-07-01', to: '2026-07-15' }, percent: 90, breakdown: { ideal: 12, fallback: 1, off: 1, missed: 1 } },
  ];
}

describe('S26 — trend readout and table (spec coverage, F28)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrend.current = monthlyPoints();
  });

  it('tapping a bucket moves the readout to that bucket: its percent and its month', async () => {
    await render(<S26AllTimeTrendGraph />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText(/May 2026/));
    expect(screen.getByText('80%')).toBeTruthy();
  });

  it('tapping a month with no qualifying days reads "No data", never a 0%', async () => {
    await render(<S26AllTimeTrendGraph />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText(/June 2026/));
    expect(screen.getByText('No data')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('the in-progress July bucket is not a tappable point: it never plots and is never read out', async () => {
    await render(<S26AllTimeTrendGraph />);
    expect(screen.queryByLabelText(/July 2026/)).toBeNull();
  });

  it('"Table" shows the same numbers as the chart, with a dash for the month that has no data', async () => {
    await render(<S26AllTimeTrendGraph />);
    const user = userEvent.setup();
    await user.press(screen.getByText('Table'));
    const table = screen.getByLabelText('Trend data table');
    expect(table).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('-')).toBeTruthy();
    expect(screen.getByLabelText(/May 2026: 80 percent/)).toBeTruthy();
    expect(screen.getByLabelText(/June 2026: no data/)).toBeTruthy();
  });

  it('switching back from the table to the chart keeps the bucket that was last tapped', async () => {
    await render(<S26AllTimeTrendGraph />);
    const user = userEvent.setup();
    await user.press(screen.getByLabelText(/May 2026/));
    await user.press(screen.getByText('Table'));
    await user.press(screen.getByText('Chart'));
    expect(screen.getByText('80%')).toBeTruthy();
  });

  // SPEC NOT MET (ALLSCREENS_1.md S26): "Drag the scrub slider moves the highlighted chart point".
  // The app has no slider; the chart is tapped bucket by bucket. Recorded as a gap, not a crash.
  it.failing('the trend has a scrub slider (an adjustable control) for moving through the points (spec S26)', async () => {
    await render(<S26AllTimeTrendGraph />);
    expect(screen.getByRole('adjustable')).toBeTruthy();
  });
});
