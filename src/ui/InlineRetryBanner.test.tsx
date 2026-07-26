import { fireEvent, render, screen } from '@testing-library/react-native';

import { InlineRetryBanner } from './InlineRetryBanner';

describe('InlineRetryBanner', () => {
  it('renders the calm read-failure copy, an alert-role region, and fires onRetry', async () => {
    const onRetry = jest.fn();
    await render(<InlineRetryBanner message="Couldn't load today's tasks. Your data is safe on this device." onRetry={onRetry} />);

    expect(screen.getByText("Couldn't load today's tasks. Your data is safe on this device.")).toBeTruthy();
    // The root View carries `accessibilityRole="alert"` without `accessible` — setting
    // `accessible` would swallow the "Retry" button inside it from individual VoiceOver/
    // TalkBack focus, so this is a structural check via the raw prop tree, not a role query.
    const alertNodes = screen.container.queryAll((n) => n.type === 'View' && n.props.accessibilityRole === 'alert');
    expect(alertNodes).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
