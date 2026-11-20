/** M0 kit — Verdant `Input`. Labeled text field, radius `sm`, inline error state. */
import type { ReactNode } from 'react';
import { StyleSheet, View, type KeyboardTypeOptions } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';
import { Text, TextInput } from '@/ui/AppText';

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
  /** Rendered inside the field, on the right (e.g. a show/hide eye). */
  readonly right?: ReactNode;
  readonly multiline?: boolean;
  readonly onSubmitEditing?: () => void;
  /** A shorter field (44 instead of 48) with the label closer, for a form that has to fit a short screen. */
  readonly dense?: boolean;
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
  right,
  multiline,
  onSubmitEditing,
  dense = false,
}: InputProps) {
  const t = useTheme();
  return (
    <View style={[styles.root, dense && styles.rootDense]}>
      {label ? <Text style={[styles.label, { color: t.color.text }]}>{label}</Text> : null}
      <View style={[styles.fieldWrap, dense && styles.fieldWrapDense, { backgroundColor: t.color.bgAlt, borderColor: error ? t.color.danger : t.color.borderStrong }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.color.textDim}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={accessibilityLabel ?? label}
          aria-invalid={!!error}
          testID={testID}
          style={[styles.field, dense && styles.fieldDense, multiline && styles.multiline, { color: t.color.text }]}
        />
        {right}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.helper, { color: t.color.dangerText }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 + 2 },
  rootDense: { gap: SPACE.s1 },
  fieldWrapDense: { minHeight: 44 },
  fieldDense: { paddingVertical: SPACE.s2, minHeight: 42 },
  label: { fontSize: 14, fontWeight: '600' },
  fieldWrap: { borderWidth: 1, borderRadius: RADIUS.md, flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingRight: 2 },
  field: { flex: 1, paddingVertical: SPACE.s2 + 2, paddingHorizontal: SPACE.s2 + 4, fontSize: 16, minHeight: 44, borderWidth: 0, ...({ outlineStyle: 'none' } as object) },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  helper: { fontSize: 14, lineHeight: 20 },
});
