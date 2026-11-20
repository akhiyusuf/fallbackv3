/** S21 — icon and color picker. Close cross (D5), one pinned Save (D8). */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Search } from 'lucide-react-native';

import { ACCENTS, FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Button, EmptyState, Input, Screen, SectionHeading, Skeleton, TaskIcon } from '@/ui';
import { useTask, useUpdateTask } from '@/queries';
import { useToastStore } from '@/app-shell/stores/toast';
import { DeletedTaskNotice, GoneTaskNotice } from '@/features/task/DeletedTaskNotice';
import { SAVE_FAILED } from '@/features/task/formShared';
import { filterIconCategories, iconByName } from '@/features/task/iconCatalog';
import type { Id, TaskColor } from '@/types';
import { Text } from '@/ui/AppText';

const COLOR_OPTIONS: readonly { key: TaskColor; label: string }[] = [
  { key: 'forge-orange', label: 'Orange' },
  { key: 'indigo', label: 'Indigo' },
  { key: 'berry', label: 'Berry' },
  { key: 'plum', label: 'Plum' },
];

export default function S21IconAndColorPicker() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = id as Id;
  const taskQuery = useTask(taskId);
  const updateTask = useUpdateTask();
  const showToast = useToastStore((s) => s.show);

  const [query, setQuery] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<TaskColor | null>(null);

  const task = taskQuery.data;
  const currentIconName = selectedIcon ?? task?.icon ?? 'Repeat';
  const currentColor = selectedColor ?? task?.color ?? 'forge-orange';
  const changed = selectedIcon !== null || selectedColor !== null;
  const categories = useMemo(() => filterIconCategories(query), [query]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace(`/task/${taskId}` as never);
  }

  async function save() {
    try {
      const result = await updateTask.mutateAsync({ id: taskId, patch: { icon: currentIconName, color: currentColor } });
      if (result.ok) close();
      else showToast(SAVE_FAILED, 'warning');
    } catch {
      showToast(SAVE_FAILED, 'warning');
    }
  }

  if (!taskQuery.isLoading && taskQuery.data === null) return <GoneTaskNotice onBack={close} />;

  if (taskQuery.isLoading || !task) {
    return (
      <Screen title="Icon and color" onBack={close} backIcon="close">
        <Skeleton height={56} />
        <Skeleton height={160} radius={16} />
      </Screen>
    );
  }

  if (task.deletedAt) return <DeletedTaskNotice taskId={taskId} name={task.name} onBack={close} />;

  return (
    <Screen
      title="Icon and color"
      onBack={close}
      backIcon="close"
      footer={<Button label="Save" onPress={save} disabled={!changed} loading={updateTask.isPending} accessibilityLabel="Save" fullWidth />}
    >
      <View style={styles.previewRow}>
        <TaskIcon icon={iconByName(currentIconName)} color={ACCENTS[currentColor].base} size={56} />
        <Text numberOfLines={1} style={[styles.previewName, { color: t.color.text }]}>
          {task.name}
        </Text>
      </View>

      <View style={styles.block}>
        <SectionHeading>Color</SectionHeading>
        <View style={styles.colorRow} accessibilityRole="radiogroup" accessibilityLabel="Color">
          {COLOR_OPTIONS.map((c) => {
            const selected = c.key === currentColor;
            return (
              <Pressable
                key={c.key}
                onPress={() => setSelectedColor(c.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={c.label}
                style={[styles.swatch, { backgroundColor: ACCENTS[c.key].base }]}
              >
                {selected ? <Check size={20} color={t.color.textOnAccent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <SectionHeading>Icon</SectionHeading>
        <Input
          label=""
          value={query}
          onChangeText={setQuery}
          placeholder="Search icons"
          accessibilityLabel="Search icons"
          testID="icon-search"
          right={
            <View style={styles.searchIcon}>
              <Search size={18} color={t.color.textDim} />
            </View>
          }
        />
      </View>

      {categories.length === 0 ? (
        <EmptyState icon={Search} headline="No icons match" subcopy={`Nothing found for "${query}". Try a different word.`} />
      ) : (
        categories.map((cat) => (
          <View key={cat.heading} style={styles.category}>
            <Text style={[styles.categoryHeading, { color: t.color.textMuted }]}>{cat.heading}</Text>
            <View style={styles.iconGrid}>
              {cat.icons.map((entry) => {
                const selected = entry.name === currentIconName;
                const EntryIcon = entry.icon;
                return (
                  <Pressable
                    key={entry.name}
                    onPress={() => setSelectedIcon(entry.name)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={entry.name}
                    style={[
                      styles.iconCell,
                      { borderColor: selected ? t.accent.fill : t.color.border, backgroundColor: selected ? t.accent.soft : t.color.bgAlt, borderWidth: selected ? 2 : 1 },
                    ]}
                  >
                    <EntryIcon size={22} color={selected ? t.accent.text : t.color.text} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  previewName: { fontSize: FONT_SIZE.md, fontWeight: '700', flex: 1 },
  block: { gap: SPACE.s2 + 4 },
  colorRow: { flexDirection: 'row', gap: SPACE.s3 },
  swatch: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  searchIcon: { paddingHorizontal: SPACE.s2 + 4 },
  category: { gap: SPACE.s2 },
  categoryHeading: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  iconCell: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
});
