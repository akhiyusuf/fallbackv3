import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import { Switch } from './Switch';

describe('Switch', () => {
  afterEach(async () => {
    // The knob's Animated.timing keeps a pending timer alive until unmount (Switch.tsx's
    // effect cleanup calls `animation.stop()`); unmounting deterministically stops it
    // instead of letting it fire into a later, unrelated test file.
    await cleanup();
  });

  it('reports its accessibility role, checked state, and toggles on press', async () => {
    const onValueChange = jest.fn();
    await render(<Switch value={false} onValueChange={onValueChange} accessibilityLabel="Mark today off" />);
    const control = screen.getByRole('switch', { name: 'Mark today off' });
    expect(control.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(control);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', async () => {
    const onValueChange = jest.fn();
    await render(<Switch value={false} onValueChange={onValueChange} accessibilityLabel="Off" disabled />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Off' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
