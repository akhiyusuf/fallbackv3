/**
 * AddMenuHost — S15 "What do you want to add?" as a bottom sheet over the
 * dimmed current screen (D3). Fallback AI leads the sheet: speaking or typing
 * is the fastest way to add something, and this is the one place it lives
 * (it is no longer a bare microphone in the Today header). Below it, each type
 * is a coloured icon circle (D14) in one grouped list (D7).
 * Mounted once in app/_layout.tsx.
 */
import { CalendarRange, ChevronRight, ListTodo, Repeat, Timer } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAddMenuStore } from '@/app-shell/stores/addMenu';
import { ROUTES } from '@/navigation';
import { play } from '@/services/sfx';
import { ACCENTS, FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Dialog, ListGroup, ListRow, TaskIcon, VoiceMark } from '@/ui';
import { Text } from '@/ui/AppText';

const ROWS = [
  { key: 'routine', title: 'Routine', descriptor: 'Repeats day to day', icon: Repeat, color: ACCENTS['forge-orange'].base, href: ROUTES.addRoutine },
  { key: 'event', title: 'Event', descriptor: 'One-off, or repeats on a schedule', icon: Timer, color: ACCENTS.indigo.base, href: ROUTES.addEvent },
  { key: 'course', title: 'Course', descriptor: 'A run with an end date, like medication', icon: CalendarRange, color: ACCENTS.berry.base, href: ROUTES.addCourse },
  { key: 'todo', title: 'To-do or note', descriptor: 'A loose task, no schedule', icon: ListTodo, color: ACCENTS.plum.base, href: ROUTES.addTodo },
] as const;

const AI_TITLE = 'Tell Fallback AI';
const AI_BODY = 'Say it or type it. It sets it up for you.';
/** How far the button's face sits above its edge (the same lift as the round add button). */
const AI_EDGE = 4;

export function AddMenuHost() {
  const t = useTheme();
  const router = useRouter();
  const open = useAddMenuStore((s) => s.open);
  const hide = useAddMenuStore((s) => s.hide);
  return (
    <Dialog visible={open} onClose={hide} title="What do you want to add?" accessibilityLabel="What do you want to add?" showClose>
      {/* A real button, built like the app's other buttons: a solid face on a darker edge that
          sinks when pressed, with an arrow. (As a pale tinted card it read as a notice.) */}
      <Pressable
        onPress={() => {
          play('tap');
          hide();
          router.push(ROUTES.assistant as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${AI_TITLE}. ${AI_BODY}`}
        testID="add-pick-assistant"
        style={[styles.aiEdge, { backgroundColor: t.accent.fillEdge }]}
      >
        {({ pressed }) => (
          <View style={[styles.ai, { backgroundColor: t.accent.fill, marginBottom: pressed ? 0 : AI_EDGE }]}>
            <VoiceMark size={44} fill={t.accent.onLarge} wave={t.accent.fill} />
            <View style={styles.aiText}>
              <Text style={[styles.aiTitle, { color: t.accent.on }]}>{AI_TITLE}</Text>
              <Text style={[styles.aiBody, { color: t.accent.on }]}>{AI_BODY}</Text>
            </View>
            <ChevronRight size={22} color={t.accent.on} />
          </View>
        )}
      </Pressable>
      <ListGroup title="Or add it yourself">
        {ROWS.map((row) => (
          <ListRow
            key={row.key}
            leading={<TaskIcon icon={row.icon} color={row.color} />}
            label={row.title}
            sublabel={row.descriptor}
            testID={`add-pick-type-${row.key}`}
            onPress={() => {
              play('tap');
              hide();
              router.push(row.href as Href);
            }}
          />
        ))}
      </ListGroup>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  aiEdge: { borderRadius: RADIUS.lg },
  ai: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, paddingVertical: SPACE.s3, paddingHorizontal: SPACE.s3, borderRadius: RADIUS.lg, minHeight: 72 },
  aiText: { flex: 1, gap: 2 },
  aiTitle: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  aiBody: { fontSize: FONT_SIZE.sm, lineHeight: 20, fontWeight: '600' },
});
