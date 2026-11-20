/** Browser round 3 (review 33): on a 320pt phone the seventh weekday chip ran off the screen. */
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { WeekdayPicker } from './WeekdayPicker';

describe('WeekdayPicker narrow phones', () => {
  it('every chip may shrink, so seven of them fit a 320pt row', async () => {
    await render(<WeekdayPicker selected={[]} onChange={() => {}} accessibilityLabel="Days" />);
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      const style = StyleSheet.flatten(screen.getByLabelText(d).props.style);
      expect(style.flexShrink).toBe(1);
      expect(style.minWidth).toBeLessThanOrEqual(40);
    }
  });
});
