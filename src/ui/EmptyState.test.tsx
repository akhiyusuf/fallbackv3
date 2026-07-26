import { fireEvent, render, screen } from '@testing-library/react-native';
import { Sprout } from 'lucide-react-native';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders headline and subcopy verbatim, with no action when none supplied', async () => {
    await render(
      <EmptyState icon={Sprout} headline="Nothing planned for today yet." subcopy="A blank slate. Add one small thing — something beats nothing." />,
    );
    expect(screen.getByRole('header', { name: 'Nothing planned for today yet.' })).toBeTruthy();
    expect(screen.getByText('A blank slate. Add one small thing — something beats nothing.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the primary action and fires onAction', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        icon={Sprout}
        headline="Nothing planned for today yet."
        subcopy="A blank slate."
        actionLabel="Add your first task"
        onAction={onAction}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Add your first task' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
