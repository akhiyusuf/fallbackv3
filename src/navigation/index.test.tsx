/**
 * `expo-router`'s own `standard-navigation` sub-dependency ships un-transpiled ESM
 * (`node_modules/standard-navigation/lib/src/index.js`, a `.js` file using `import`) that
 * still isn't covered by `jest.config.js`'s centrally-fixed lucide CJS mapping or its
 * `.mjs` transform (`standard-navigation` is neither lucide nor `.mjs`) — importing the
 * real `expo-router` package under Jest still throws `Cannot use import statement outside a
 * module` before any test runs. This mock is a live, still-necessary workaround (unlike the
 * lucide one, which the house pattern says to drop) — flagged as a further contract-change
 * request in the M0 build report.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { renderHook } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

import { useOriginAwareBack, withOrigin } from './index';

const mockUseRouter = useRouter as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

async function renderBack(fallback: string): Promise<() => void> {
  const { result } = await renderHook(() => useOriginAwareBack(fallback));
  return result.current!;
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

  it('replaces to the origin route when `from` names a static, always-reachable screen', async () => {
    const replace = jest.fn();
    mockUseRouter.mockReturnValue({ replace, back: jest.fn(), canGoBack: () => true });
    mockUseLocalSearchParams.mockReturnValue({ from: 'today' });

    const back = await renderBack('/search');
    back();

    expect(replace).toHaveBeenCalledWith('/today');
  });

  it('falls back to the navigation stack when there is no static origin mapping', async () => {
    const goBack = jest.fn();
    mockUseRouter.mockReturnValue({ replace: jest.fn(), back: goBack, canGoBack: () => true });
    mockUseLocalSearchParams.mockReturnValue({ from: 'manage' });

    const back = await renderBack('/task/1');
    back();

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('falls back to the caller-supplied href when there is no origin and no back stack (cold deep link)', async () => {
    const replace = jest.fn();
    mockUseRouter.mockReturnValue({ replace, back: jest.fn(), canGoBack: () => false });
    mockUseLocalSearchParams.mockReturnValue({});

    const back = await renderBack('/today');
    back();

    expect(replace).toHaveBeenCalledWith('/today');
  });
});
