/**
 * NotificationSample — one reminder drawn the way the phone shows it: app icon, app name,
 * when, a bold first line and a second line. The wording is the wording the reminder
 * service sends. Dimmed when that kind of reminder is switched off. Tapping it plays the
 * reminder sound.
 */
import { Sprout } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { play } from '@/services/sfx';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Text } from '@/ui/AppText';

export interface NotificationSampleProps {
  readonly title: string;
  readonly body: string;
  readonly when: string;
  readonly off?: boolean;
}

export function NotificationSample({ title, body, when, off = false }: NotificationSampleProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => play('reminder')}
      accessibilityRole="button"
      accessibilityHint="Plays the reminder sound"
      accessibilityLabel={`${off ? 'Off. ' : ''}Looks like: Fallback, ${when}. ${title}. ${body}`}
      style={[styles.root, { backgroundColor: t.color.surface, opacity: off ? 0.45 : 1 }]}
    >
      <View style={[styles.appIcon, { backgroundColor: t.accent.fill }]}>
        <Sprout size={20} color={t.accent.onLarge} strokeWidth={2.5} />
      </View>
      <View style={styles.text}>
        <View style={styles.top}>
          <Text style={[styles.app, { color: t.color.textMuted }]}>Fallback</Text>
          <Text style={[styles.app, { color: t.color.textMuted }]}>{when}</Text>
        </View>
        <Text style={[styles.title, { color: t.color.text }]}>{title}</Text>
        <Text style={[styles.body, { color: t.color.text }]}>{body}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: SPACE.s3, padding: SPACE.s3, borderRadius: RADIUS.lg, marginHorizontal: SPACE.s3, marginBottom: SPACE.s3 },
  appIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  app: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  title: { fontSize: FONT_SIZE.sm, fontWeight: '800', lineHeight: 19 },
  body: { fontSize: FONT_SIZE.sm, lineHeight: 19 },
});
