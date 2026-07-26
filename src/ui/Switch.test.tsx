import { act, create } from 'react-test-renderer';

import { Switch } from './Switch';

describe('Switch', () => {
  let renderer: ReturnType<typeof create> | undefined;

  afterEach(() => {
    // The knob's Animated.timing keeps a pending timer alive until unmount (Switch.tsx's
    // effect cleanup calls `animation.stop()`); unmounting here stops it deterministically
    // instead of letting it fire into a later, unrelated test file.
    act(() => renderer?.unmount());
    renderer = undefined;
  });

  it('reports its accessibility role, checked state, and toggles on press', () => {
    const onValueChange = jest.fn();
    act(() => {
      renderer = create(<Switch value={false} onValueChange={onValueChange} accessibilityLabel="Mark today off" />);
    });
    const control = renderer!.root.findByProps({ accessibilityRole: 'switch' });
    expect(control.props.accessibilityState.checked).toBe(false);
    act(() => {
      control.props.onPress();
    });
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', () => {
    const onValueChange = jest.fn();
    act(() => {
      renderer = create(<Switch value={false} onValueChange={onValueChange} accessibilityLabel="Off" disabled />);
    });
    const control = renderer!.root.findByProps({ accessibilityRole: 'switch' });
    act(() => {
      control.props.onPress();
    });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
