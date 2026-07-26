import { act, create } from 'react-test-renderer';

import { useToastStore } from '@/app-shell/stores/toast';

import { Toast } from './Toast';

describe('Toast', () => {
  afterEach(() => {
    act(() => useToastStore.getState().hide());
  });

  it('renders nothing when the store holds no toast', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Toast />);
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it('renders the store message as an alert once shown', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Toast />);
    });
    act(() => useToastStore.getState().show('Today marked off — nothing due counts against your %.'));
    const alert = renderer!.root.findByProps({ accessibilityRole: 'alert' });
    expect(alert.props.accessibilityLabel).toBe('Today marked off — nothing due counts against your %.');
  });

  it('dismisses on tap', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Toast />);
    });
    act(() => useToastStore.getState().show('Couldn’t save that — try again.'));
    const alert = renderer!.root.findByProps({ accessibilityRole: 'alert' });
    act(() => {
      alert.props.onPress();
    });
    expect(useToastStore.getState().toast).toBeNull();
  });
});
