/**
 * M4 — shared ideal/fallback step-row editor (S16/S17/S18): drag handle (decorative — no
 * reorder gesture in v1), text Input, ghost delete IconButton, "+ Add step" Button.
 */
import { StyleSheet, Text, View } from 'react-native';
import { GripVertical, Plus, Trash2 } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Button, IconButton, Input } from '@/ui';
import type { StepDraft } from '@/types';

export interface StepListEditorProps {
  readonly label: string;
  /** Short noun used per-row, e.g. "Ideal step" / "Fallback step" — `label` itself is often a longer sentence. */
  readonly itemLabel: string;
  readonly helper?: string;
  readonly steps: readonly StepDraft[];
  readonly onChange: (steps: readonly StepDraft[]) => void;
  readonly addLabel?: string;
  readonly error?: string;
  readonly testID?: string;
}

export function StepListEditor({ label, itemLabel, helper, steps, onChange, addLabel = '+ Add step', error, testID }: StepListEditorProps) {
  const t = useTheme();

  const updateText = (index: number, text: string) => {
    onChange(steps.map((s, i) => (i === index ? { ...s, text } : s)));
  };
  const removeAt = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };
  const add = () => {
    onChange([...steps, { text: '', dueWeekdays: null }]);
  };

  return (
    <View style={styles.root} testID={testID}>
      <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
      {helper ? <Text style={[styles.helper, { color: t.color.textMuted }]}>{helper}</Text> : null}
      {steps.map((step, i) => (
        <View key={i} style={styles.row}>
          <GripVertical size={18} color={t.color.textDim} accessibilityElementsHidden importantForAccessibility="no" />
          <View style={styles.inputWrap}>
            <Input
              label={`${itemLabel} ${i + 1}`}
              value={step.text}
              onChangeText={(text) => updateText(i, text)}
              placeholder="e.g. Review notes (30 min)"
              accessibilityLabel={`${itemLabel} ${i + 1}`}
            />
          </View>
          <IconButton icon={Trash2} onPress={() => removeAt(i)} accessibilityLabel={`Delete ${itemLabel.toLowerCase()} ${i + 1}`} />
        </View>
      ))}
      <Button label={addLabel} onPress={add} variant="secondary" icon={<Plus size={16} color={t.color.text} />} accessibilityLabel={addLabel} />
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: t.color.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACE.s2 },
  label: { fontSize: 14, fontWeight: '600' },
  helper: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  inputWrap: { flex: 1 },
  error: { fontSize: 14 },
});
