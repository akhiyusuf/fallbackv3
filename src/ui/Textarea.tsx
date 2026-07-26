/** M0 kit — Verdant `Textarea`. Multi-line labeled field, no character-count UI (per S19). */
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface TextareaProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function Textarea({ label, value, onChangeText, placeholder, accessibilityLabel, testID }: TextareaProps) {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.color.textDim}
        multiline
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="text"
        testID={testID}
        style={[styles.field, { backgroundColor: t.color.bg, borderColor: t.color.border, color: t.color.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 },
  label: { fontSize: 14, fontWeight: '600' },
  field: { borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s2, fontSize: 16, minHeight: 96, textAlignVertical: 'top' },
});
