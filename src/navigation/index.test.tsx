/**
 * `expo-router`'s own `standard-navigation` sub-dependency ships un-transpiled ESM that
 * isn't covered by `jest.config.js`'s (frozen) `transformIgnorePatterns` allowlist, so
 * importing the real package under Jest throws a syntax error before any test runs. This
 * file mocks `expo-router` at the module boundary so `src/navigation` — which only needs
 * `useRouter`/`useLocalSearchParams` — never reaches that transitive import. Flagged as a
 * contract-change request (jest.config.js) in the M0 build report.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { act, create } from 'react-test-renderer';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

import { useOriginAwareBack, withOrigin } from './index';

const mockUseRouter = useRouter as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

function renderBack(fallback: string): () => void {
  let captured: (() => void) | undefined;
  function Probe() {
    captured = useOriginAwareBack(fallback);
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return captured!;
}

describe('withOrigin', () => {
  it('appends a `from` origin query param to a bare href', () => {
    expect(withOrigin('/search', 'today')).toBe('/search?from=today');
  });

  it('appends with `&` when the href already carries a query string', () => {
    expect(withOrigin('/task/1?tab=history', 'routines')).toBe('/task/1?tab=history&from=routines');
  });
});

describe('useOriginAwareBack', () => {
  afterEach(() => jest.clearAllMocks());

  it('replaces to the origin route when `from` names a static, always-reachable screen', () => {
    const replace = jest.fn();
    mockUseRouter.mockReturnValue({ replace, back: jest.fn(), canGoBack: () => true });
    mockUseLocalSearchParams.mockReturnValue({ from: 'today' });

    const back = renderBack('/search');
    back();

    expect(replace).toHaveBeenCalledWith('/today');
  });

  it('falls back to the navigation stack when there is no static origin mapping', () => {
    const goBack = jest.fn();
    mockUseRouter.mockReturnValue({ replace: jest.fn(), back: goBack, canGoBack: () => true });
    mockUseLocalSearchParams.mockReturnValue({ from: 'manage' });

    const back = renderBack('/task/1');
    back();

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('falls back to the caller-supplied href when there is no origin and no back stack (cold deep link)', () => {
    const replace = jest.fn();
    mockUseRouter.mockReturnValue({ replace, back: jest.fn(), canGoBack: () => false });
    mockUseLocalSearchParams.mockReturnValue({});

    const back = renderBack('/today');
    back();

    expect(replace).toHaveBeenCalledWith('/today');
  });
});
