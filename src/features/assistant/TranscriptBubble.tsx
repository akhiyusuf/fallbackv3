/** One chat bubble. The user's sits right in the accent tint; the assistant's sits left. */
import { StyleSheet, View } from 'react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { VoiceMark } from '@/ui';
import { Text } from '@/ui/AppText';

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
        <View style={[styles.avatar, { backgroundColor: t.accent.soft }]} accessibilityElementsHidden importantForAccessibility="no">
          <VoiceMark size={22} />
        </View>
      )}
      <View
        style={[styles.bubble, isUser ? { backgroundColor: t.accent.soft } : { backgroundColor: t.color.bgAlt, borderColor: t.color.border, borderWidth: 1 }]}
        accessible
        accessibilityLabel={`${isUser ? 'You' : 'Fallback AI'} said: ${text}`}
      >
        <Text style={[styles.text, { color: t.color.text }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.s2, maxWidth: '88%', alignSelf: 'flex-start' },
  rowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderRadius: RADIUS.lg, paddingVertical: SPACE.s2 + 2, paddingHorizontal: SPACE.s3, flexShrink: 1 },
  text: { fontSize: FONT_SIZE.base, lineHeight: 24 },
});
