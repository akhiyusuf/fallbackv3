/** M0 kit — Verdant `Textarea`. Multi-line labeled field, no character-count UI (per S19). */
import { StyleSheet, View } from 'react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';
import { Text, TextInput } from '@/ui/AppText';

export interface TextareaProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder?: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly helper?: string;
}

export function Textarea({ label, value, onChangeText, placeholder, accessibilityLabel, testID, helper }: TextareaProps) {
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
        style={[styles.field, { backgroundColor: t.color.bgAlt, borderColor: t.color.borderStrong, color: t.color.text }]}
      />
      {helper ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s1 + 2 },
  helper: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600' },
  field: { borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACE.s2 + 2, paddingHorizontal: SPACE.s2 + 4, fontSize: 16, minHeight: 96, textAlignVertical: 'top' },
});
