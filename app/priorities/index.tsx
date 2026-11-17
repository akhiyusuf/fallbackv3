/**
 * Priorities    route: /priorities
 * High, Medium and Low each hold a list in the person's own order. The arrows move a task up or
 * down inside its level; the order is saved as `task.priorityRank`.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ArrowDown, ArrowUp, ListOrdered } from 'lucide-react-native';

import { useToastStore } from '@/app-shell';
import { taskIconProps } from '@/features/browse/resolveIcon';
import { PRIORITY_LEVELS, usePriorityGroups } from '@/features/priorities/order';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { useUpdateTask } from '@/queries';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import type { Id, Importance, TaskWithSteps } from '@/types';
import { cardSurface, EmptyState, InlineRetryBanner, Screen, Skeleton, Tabs, TaskIcon } from '@/ui';
import { Text } from '@/ui/AppText';

const TYPE_TITLE = { routine: 'Routine', event: 'Event', course: 'Course', todo: 'To-do' } as const;
const NECESSITY_TITLE = { 'must-do': 'Must-do', recommended: 'Recommended', optional: 'Optional' } as const;

function isLevel(v: string | undefined): v is Importance {
  return v === 'high' || v === 'med' || v === 'low';
}

export default function PrioritiesScreen() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.today);
  const params = useLocalSearchParams<{ level?: string }>();
  const showToast = useToastStore((s) => s.show);
  const updateTask = useUpdateTask();
  const { groups, isLoading, isError, refetch } = usePriorityGroups();
  const [level, setLevel] = useState<Importance>(isLevel(params.level) ? params.level : 'high');
  /** The order on screen while a move is being saved, so the row moves at once. */
  const [pending, setPending] = useState<readonly Id[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setPending(null), [level]);

  const saved = groups[level];
  const byId = new Map(saved.map((tk) => [tk.id, tk] as const));
  const list: readonly TaskWithSteps[] = pending ? pending.map((id) => byId.get(id)).filter((tk): tk is TaskWithSteps => !!tk) : saved;
  const levelLabel = PRIORITY_LEVELS.find((l) => l.value === level)?.label ?? '';

  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (saving || target < 0 || target >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    setPending(next.map((tk) => tk.id));
    setSaving(true);
    let failed = false;
    // Write every place that changed, so tasks that were never placed get a real rank too.
    for (let i = 0; i < next.length; i += 1) {
      const tk = next[i]!;
      if (tk.priorityRank === i) continue;
      const result = await updateTask.mutateAsync({ id: tk.id as Id, patch: { priorityRank: i } });
      if (!result.ok) failed = true;
    }
    setSaving(false);
    setPending(null);
    if (failed) showToast("Couldn't save the new order. Try again.", 'warning');
    else AccessibilityInfo.announceForAccessibility?.(`${moved.name}, now number ${target + 1} of ${next.length}`);
  }

  return (
    <Screen title="Priorities" level="page" onBack={goBack}>
      <Tabs
        items={PRIORITY_LEVELS.map((l) => ({ value: l.value, label: groups[l.value].length > 0 ? `${l.label} · ${groups[l.value].length}` : l.label }))}
        value={level}
        onChange={(v) => setLevel(v as Importance)}
        accessibilityLabel="Importance level"
      />

      {isLoading ? (
        <>
          <Skeleton height={76} radius={20} />
          <Skeleton height={76} radius={20} />
        </>
      ) : isError ? (
        <InlineRetryBanner message="Couldn't load your tasks." onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={ListOrdered} headline={`Nothing marked ${levelLabel.toLowerCase()} yet`} subcopy="Set a task's importance on its own screen and it shows up here." />
      ) : (
        <>
          <Text style={[styles.intro, { color: t.color.textMuted }]}>
            {list.length === 1 ? 'The only one at this level.' : 'In your order: the top one matters most. Use the arrows to move one up or down.'}
          </Text>
          <View style={styles.list}>
            {list.map((tk, index) => (
              <View key={tk.id} style={[styles.row, cardSurface(t)]}>
                <Pressable
                  onPress={() => router.push(`/task/${tk.id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`Number ${index + 1} of ${list.length}: ${tk.name}. Opens the task`}
                  style={styles.open}
                >
                  <Text style={[styles.rank, { color: t.accent.text }]}>{index + 1}</Text>
                  <TaskIcon {...taskIconProps(tk)} />
                  <View style={styles.text}>
                    <Text numberOfLines={2} style={[styles.name, { color: t.color.text }]}>
                      {tk.name}
                    </Text>
                    <Text numberOfLines={1} style={[styles.meta, { color: t.color.textMuted }]}>
                      {[TYPE_TITLE[tk.type], tk.necessity ? NECESSITY_TITLE[tk.necessity] : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
                {list.length > 1 ? (
                  <View style={styles.arrows}>
                    <ArrowButton icon={ArrowUp} label={`Move ${tk.name} up`} disabled={index === 0 || saving} onPress={() => void move(index, -1)} />
                    <ArrowButton icon={ArrowDown} label={`Move ${tk.name} down`} disabled={index === list.length - 1 || saving} onPress={() => void move(index, 1)} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function ArrowButton({ icon: Icon, label, disabled, onPress }: { readonly icon: typeof ArrowUp; readonly label: string; readonly disabled: boolean; readonly onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.arrow, { backgroundColor: pressed ? t.accent.soft : t.color.surface, opacity: disabled ? 0.35 : 1 }]}
    >
      <Icon size={18} color={t.color.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  list: { gap: SPACE.s2 + 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, paddingVertical: SPACE.s2 + 4, paddingLeft: SPACE.s3, paddingRight: SPACE.s2 + 4 },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4 },
  rank: { minWidth: 18, textAlign: 'center', fontSize: FONT_SIZE.lg, fontWeight: '800', fontVariant: ['tabular-nums'] },
  text: { flex: 1, gap: 2 },
  name: { fontSize: FONT_SIZE.base, lineHeight: 22, fontWeight: '700' },
  meta: { fontSize: FONT_SIZE.sm },
  arrows: { flexDirection: 'row', gap: SPACE.s1 + 2 },
  arrow: { width: 38, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
});
