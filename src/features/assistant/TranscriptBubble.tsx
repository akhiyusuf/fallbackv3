/** M6. A single user/assistant text bubble in S32/S35's transcript. */
import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { RADIUS, SPACE, useTheme } from '@/theme';

export interface TranscriptBubbleProps {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

export function TranscriptBubble({ role, text }: TranscriptBubbleProps) {
  const t = useTheme();
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {isUser ? null : (
        <View style={[styles.avatar, { backgroundColor: t.color.surface }]} accessibilityElementsHidden importantForAccessibility="no">
          <Sparkles size={14} color={t.accent.base} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          { backgroundColor: isUser ? t.accent.soft : t.color.bgAlt, borderColor: t.color.border },
        ]}
        accessible
        accessibilityLabel={`${isUser ? 'You' : 'Fallback AI'} said: ${text}`}
      >
        <Text style={[styles.text, { color: t.color.text }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.s1, maxWidth: '90%', alignSelf: 'flex-start' },
  rowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s2, flexShrink: 1 },
  text: { fontSize: 15, lineHeight: 22 },
});
