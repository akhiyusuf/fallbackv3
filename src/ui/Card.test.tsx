import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from './Card';

describe('Card', () => {
  it('is inert (non-pressable) with no onPress', async () => {
    await render(
      <Card>
        <Text>Movement</Text>
      </Card>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('fires onPress when tappable and exposes accessibilityLabel', async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress} accessibilityLabel="Movement task">
        <Text>Movement</Text>
      </Card>,
    );
    const card = screen.getByRole('button', { name: 'Movement task' });
    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
