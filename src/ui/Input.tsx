/** M0 kit — Verdant `Input`. Labeled text field, radius `sm`, inline error state. */
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface InputProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder?: string;
  readonly error?: string;
  readonly helper?: string;
  readonly autoFocus?: boolean;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly secureTextEntry?: boolean;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  autoFocus,
  keyboardType,
  secureTextEntry,
  accessibilityLabel,
  testID,
}: InputProps) {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.color.textDim}
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="text"
        aria-invalid={!!error}
        testID={testID}
        style={[
          styles.field,
          {
            backgroundColor: t.color.bg,
            borderColor: error ? t.color.danger : t.color.border,
            color: t.color.text,
          },
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: t.color.danger }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 },
  label: { fontSize: 14, fontWeight: '600' },
  field: { borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s2, fontSize: 16 },
  helper: { fontSize: 14, lineHeight: 20 },
});
