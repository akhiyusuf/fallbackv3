import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { Card } from './Card';

describe('Card', () => {
  it('is inert (non-pressable) with no onPress', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <Card>
          <Text>Movement</Text>
        </Card>,
      );
    });
    const pressables = renderer!.root.findAllByProps({ accessibilityRole: 'button' });
    expect(pressables).toHaveLength(0);
  });

  it('fires onPress when tappable and exposes accessibilityLabel', () => {
    const onPress = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <Card onPress={onPress} accessibilityLabel="Movement task">
          <Text>Movement</Text>
        </Card>,
      );
    });
    const pressable = renderer!.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityLabel).toBe('Movement task');
    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
