/**
 * ButtonPair — the only way two buttons sit together (D11): full width,
 * stacked, main (or danger) action on top, outlined secondary below.
 */
import { StyleSheet, View } from 'react-native';

import { SPACE } from '@/theme';
import { Button } from './Button';

export interface ButtonPairAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export interface ButtonPairProps {
  readonly primary: ButtonPairAction & { readonly danger?: boolean };
  readonly secondary: ButtonPairAction;
}

export function ButtonPair({ primary, secondary }: ButtonPairProps) {
  return (
    <View style={styles.root}>
      <Button
        label={primary.label}
        onPress={primary.onPress}
        variant={primary.danger ? 'danger' : 'primary'}
        loading={primary.loading}
        disabled={primary.disabled}
        accessibilityLabel={primary.accessibilityLabel ?? primary.label}
        testID={primary.testID}
        fullWidth
      />
      <Button
        label={secondary.label}
        onPress={secondary.onPress}
        variant="secondary"
        loading={secondary.loading}
        disabled={secondary.disabled}
        accessibilityLabel={secondary.accessibilityLabel ?? secondary.label}
        testID={secondary.testID}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: SPACE.s2, alignSelf: 'stretch' } });
