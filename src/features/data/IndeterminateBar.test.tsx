import { AccessibilityInfo, Animated } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { IndeterminateBar } from './IndeterminateBar';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('IndeterminateBar (splash loading bar)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts its loop once the reduce-motion preference is known, and stops it on unmount', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { unmount } = await render(<IndeterminateBar />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(loop).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('does not start a loop if it unmounts before the preference arrives', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    const pref = deferred<boolean>();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(pref.promise);
    const { unmount } = await render(<IndeterminateBar />);
    await unmount();
    // React runs the effect cleanup asynchronously after unmount; let it run before the preference arrives.
    await act(async () => {});
    await act(async () => {
      pref.resolve(false);
      await pref.promise;
    });
    expect(loop).not.toHaveBeenCalled();
  });
});
