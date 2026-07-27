/**
 * S15 — Add Task: Pick Type    route: /add
 * Owner: M4. Features: F2, F11.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S15)
 */
import { StyleSheet, Text, View } from 'react-native';
import { CalendarRange, ChevronRight, ListTodo, Repeat, Timer, X } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';

import { SPACE, useTheme } from '@/theme';
import { Card, IconButton } from '@/ui';
import { ROUTES } from '@/navigation';

interface TypeRow {
  readonly key: string;
  readonly title: string;
  readonly descriptor: string;
  readonly icon: typeof Repeat;
  readonly href: string;
}

const ROWS: readonly TypeRow[] = [
  { key: 'routine', title: 'Routine', descriptor: 'Recurring, day to day', icon: Repeat, href: ROUTES.addRoutine },
  { key: 'event', title: 'Event', descriptor: 'One-off, or repeats on a schedule', icon: Timer, href: ROUTES.addEvent },
  { key: 'course', title: 'Course', descriptor: 'A run with an end date — meds, a challenge', icon: CalendarRange, href: ROUTES.addCourse },
  { key: 'todo', title: 'To-do / Note', descriptor: 'A loose task, no schedule', icon: ListTodo, href: ROUTES.addTodo },
];

export default function S15AddTaskPickType() {
  const t = useTheme();
  const router = useRouter();

  const close = () => (router.canGoBack() ? router.back() : router.replace(ROUTES.today));

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]} accessibilityLabel="What do you want to add?" accessibilityViewIsModal>
      <Stack.Screen options={{ presentation: 'modal' }} />
      <View style={[styles.handle, { backgroundColor: t.color.border }]} />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
          What do you want to add?
        </Text>
        <IconButton icon={X} onPress={close} accessibilityLabel="Close" />
      </View>

      <View style={styles.list}>
        {ROWS.map((row) => (
          <Card
            key={row.key}
            onPress={() => router.push(row.href as never)}
            accessibilityLabel={`${row.title}, ${row.descriptor}`}
            testID={`add-pick-type-${row.key}`}
          >
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: t.color.surface }]}>
                <row.icon size={22} color={t.color.text} />
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.rowTitle, { color: t.color.text }]}>{row.title}</Text>
                <Text style={[styles.rowDescriptor, { color: t.color.textMuted }]}>{row.descriptor}</Text>
              </View>
              <ChevronRight size={20} color={t.color.textDim} />
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: SPACE.s3, gap: SPACE.s3 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  list: { gap: SPACE.s2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowDescriptor: { fontSize: 14 },
});
