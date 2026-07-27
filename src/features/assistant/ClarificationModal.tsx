/**
 * S33 — Assistant Clarification (modal). No route — renders within `/assistant/chat`
 * (docs/MODULES.md). Presented over S32 when the assistant proposes an
 * `ask_clarification` tool call.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic, Sparkles } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Card, Dialog } from '@/ui';
import { S33_COPY } from './copy';

export interface ClarificationOption {
  readonly taskId: string;
  readonly label: string;
}

export interface ClarificationModalProps {
  readonly visible: boolean;
  readonly question: string;
  readonly options: readonly ClarificationOption[];
  readonly onResolve: (taskId: string) => void;
  readonly onDismiss: () => void;
  /** Non-null renders the calm re-ask state (an unresolved spoken answer), never an error. */
  readonly reAskText?: string | null;
}

export function ClarificationModal({ visible, question, options, onResolve, onDismiss, reAskText }: ClarificationModalProps) {
  const t = useTheme();
  const [listening, setListening] = useState(false);

  return (
    <Dialog visible={visible} onClose={onDismiss} accessibilityLabel="Quick check" presentation="sheet">
      <View style={styles.header}>
        <Sparkles size={16} color={t.accent.base} />
        <Text style={[styles.headerLabel, { color: t.color.textMuted }]}>{S33_COPY.headerLabel}</Text>
      </View>
      <Text accessibilityRole="header" style={[styles.question, { color: t.color.text }]}>
        {reAskText ?? question}
      </Text>
      <View style={styles.options}>
        {options.map((option) => (
          <Card key={option.taskId} onPress={() => onResolve(option.taskId)} accessibilityLabel={`${option.label}, button`}>
            <Text style={[styles.optionLabel, { color: t.color.text }]}>{option.label}</Text>
          </Card>
        ))}
      </View>
      <Pressable
        onPress={() => setListening((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Or just say which one, alternative input method"
        style={styles.voiceRow}
      >
        <Mic size={18} color={t.color.textMuted} />
        <Text style={[styles.voiceCaption, { color: t.color.textMuted }]}>
          {listening ? S33_COPY.listening : S33_COPY.voiceCaption}
        </Text>
      </Pressable>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  headerLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  question: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  options: { gap: SPACE.s2 },
  optionLabel: { fontSize: 15, lineHeight: 22 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, paddingTop: SPACE.s1, minHeight: 44 },
  voiceCaption: { fontSize: 13 },
});
