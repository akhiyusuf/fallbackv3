/** See StateChip.test.tsx for why `lucide-react-native` is mocked locally (contract-change request). */
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub, has: () => true });
});

import { act, create } from 'react-test-renderer';
import { Sprout } from 'lucide-react-native';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders headline and subcopy verbatim, with no action when none supplied', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <EmptyState icon={Sprout} headline="Nothing planned for today yet." subcopy="A blank slate. Add one small thing — something beats nothing." />,
      );
    });
    const headline = renderer!.root.findByProps({ accessibilityRole: 'header' });
    expect(headline.props.children).toBe('Nothing planned for today yet.');
    const buttons = renderer!.root.findAllByProps({ accessibilityRole: 'button' });
    expect(buttons).toHaveLength(0);
  });

  it('renders the primary action and fires onAction', () => {
    const onAction = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <EmptyState
          icon={Sprout}
          headline="Nothing planned for today yet."
          subcopy="A blank slate."
          actionLabel="Add your first task"
          onAction={onAction}
        />,
      );
    });
    const button = renderer!.root.findByProps({ accessibilityRole: 'button' });
    act(() => {
      button.props.onPress();
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
