/** S33 — the assistant's "which one did you mean?" sheet. */
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Mic } from 'lucide-react-native';

import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Dialog, ListGroup, ListRow } from '@/ui';
import { S33_COPY } from './copy';
import { Text } from '@/ui/AppText';

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
  readonly reAskText?: string | null;
}

export function ClarificationModal({ visible, question, options, onResolve, onDismiss, reAskText }: ClarificationModalProps) {
  const t = useTheme();
  const [listening, setListening] = useState(false);

  return (
    <Dialog visible={visible} onClose={onDismiss} title={reAskText ?? question} accessibilityLabel={S33_COPY.headerLabel} presentation="sheet">
      <ListGroup>
        {options.map((option) => (
          <ListRow key={option.taskId} label={option.label} onPress={() => onResolve(option.taskId)} chevron={false} />
        ))}
      </ListGroup>
      <Pressable onPress={() => setListening((v) => !v)} accessibilityRole="button" accessibilityLabel="Or just say which one" style={styles.voiceRow}>
        <Mic size={18} color={t.color.textMuted} />
        <Text style={[styles.voiceCaption, { color: t.color.textMuted }]}>{listening ? S33_COPY.listening : S33_COPY.voiceCaption}</Text>
      </Pressable>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  voiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s2, minHeight: 44 },
  voiceCaption: { fontSize: FONT_SIZE.sm },
});
