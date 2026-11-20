/**
 * TaskHero — the top of a task's own screen: a block washed in the task's color, its icon on
 * a solid tile, its name large, and (for a task on a schedule) the last seven days.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Pencil } from 'lucide-react-native';

import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import type { Id } from '@/types';
import { tintedSurface, WeekStrip, type IconComponent } from '@/ui';

import { useWeekStrip } from './useWeekStrip';
import { Text } from '@/ui/AppText';

export interface TaskHeroProps {
  readonly taskId: Id;
  readonly name: string;
  readonly icon: IconComponent;
  /** The task's own color (hex). */
  readonly color: string;
  /** Schedule, time, importance: joined with dots on one or two lines. */
  readonly meta: readonly string[];
  readonly showWeek: boolean;
  readonly onIconPress: () => void;
}

export function TaskHero({ taskId, name, icon: Icon, color, meta, showWeek, onIconPress }: TaskHeroProps) {
  const t = useTheme();
  const surface = tintedSurface(t, color);
  const wash = surface.backgroundColor as string;
  return (
    <View style={[styles.root, surface]}>
      <View style={styles.top}>
        <Pressable onPress={onIconPress} accessibilityRole="button" accessibilityLabel="Change icon and color" testID="s20-icon-avatar" style={[styles.tile, { backgroundColor: color }]}>
          <Icon size={30} color={t.color.textOnAccent} />
          <View style={[styles.edit, { backgroundColor: t.color.bgAlt, borderColor: wash }]}>
            <Pencil size={11} color={t.color.text} />
          </View>
        </Pressable>
        <View style={styles.text}>
          <Text accessibilityRole="header" numberOfLines={2} style={[styles.name, { color: t.color.text }]}>
            {name}
          </Text>
          {meta.length > 0 ? (
            <Text numberOfLines={2} style={[styles.meta, { color: t.color.text }]}>
              {meta.join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>
      {showWeek ? <HeroWeek taskId={taskId} /> : null}
    </View>
  );
}

function HeroWeek({ taskId }: { readonly taskId: Id }) {
  const t = useTheme();
  return (
    <View style={[styles.week, { backgroundColor: t.color.bgAlt }]}>
      <WeekStrip days={useWeekStrip(taskId)} size={30} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: SPACE.s3 - 2, gap: SPACE.s3 },
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  tile: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  edit: { position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4 },
  name: { fontSize: FONT_SIZE.xl, lineHeight: 28, fontWeight: '800' },
  meta: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  week: { borderRadius: RADIUS.lg, paddingVertical: SPACE.s2 + 2, paddingHorizontal: SPACE.s2 },
});
