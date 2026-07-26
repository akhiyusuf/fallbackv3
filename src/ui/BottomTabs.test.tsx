import { fireEvent, render, screen } from '@testing-library/react-native';
import { Sun } from 'lucide-react-native';

import { BottomTabs, PRIMARY_NAV_ITEMS } from './BottomTabs';

describe('PRIMARY_NAV_ITEMS', () => {
  it('matches the approved handoff tab bar order, and Today uses `Sun` (REVIEW-M0.md item 8)', () => {
    expect(PRIMARY_NAV_ITEMS.map((i) => i.key)).toEqual(['today', 'routines', 'events', 'courses', 'todos']);
    expect(PRIMARY_NAV_ITEMS[0]!.icon).toBe(Sun);
  });
});

describe('BottomTabs', () => {
  it('renders one tab per item and reports the active one', async () => {
    await render(<BottomTabs items={PRIMARY_NAV_ITEMS} activeKey="today" onSelect={jest.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Today', selected: true })).toBeTruthy();
  });

  it('fires onSelect with the tapped tab key', async () => {
    const onSelect = jest.fn();
    await render(<BottomTabs items={PRIMARY_NAV_ITEMS} activeKey="today" onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Routines' }));
    expect(onSelect).toHaveBeenCalledWith('routines');
  });
});
