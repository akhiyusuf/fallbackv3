import { act, create } from 'react-test-renderer';

import { InlineRetryBanner } from './InlineRetryBanner';

describe('InlineRetryBanner', () => {
  it('renders the calm read-failure copy and fires onRetry', () => {
    const onRetry = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<InlineRetryBanner message="Couldn't load today's tasks. Your data is safe on this device." onRetry={onRetry} />);
    });
    const alert = renderer!.root.findByProps({ accessibilityRole: 'alert' });
    expect(alert.props.accessibilityRole).toBe('alert');
    const retry = renderer!.root.findByProps({ accessibilityRole: 'button' });
    act(() => {
      retry.props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
