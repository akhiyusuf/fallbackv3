/**
 * NOTE: `@testing-library/react-native@14` declares a peer dependency on a package
 * literally named `test-renderer` that is not present in `package.json`/`package-lock.json`
 * (frozen, architect-owned) — importing `@testing-library/react-native` throws
 * `Cannot find module 'test-renderer'` under this project's exact dependency set. Kit
 * component tests use `react-test-renderer` directly instead (already present as a
 * transitive dependency of the RN/jest-expo toolchain, so this adds nothing to
 * `package.json`). Flagged as a contract-change request in the M0 build report.
 */
import { act, create } from 'react-test-renderer';

import { Button } from './Button';

describe('Button', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Button label="Save routine" onPress={onPress} />);
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityLabel).toBe('Save routine');
    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Button label="Save" onPress={onPress} disabled />);
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.onPress).toBeUndefined();
  });

  it('does not fire onPress while loading', () => {
    const onPress = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Button label="Save" onPress={onPress} loading />);
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.onPress).toBeUndefined();
    expect(pressable.props.accessibilityState.busy).toBe(true);
  });

  it('accepts an explicit accessibilityLabel distinct from the visible label', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Button label="Retry" onPress={() => {}} accessibilityLabel="Retry loading today's tasks" />);
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityLabel).toBe("Retry loading today's tasks");
  });
});
