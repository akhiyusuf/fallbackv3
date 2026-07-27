/**
 * S21 — Icon & Color Picker    route: /task/:id/icon
 * Owner: M4. Features: F7.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S21)
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Search, X } from 'lucide-react-native';

import { ACCENTS, SPACE, useTheme } from '@/theme';
import { Button, EmptyState, IconButton, Input, Skeleton } from '@/ui';
import { useTask, useUpdateTask } from '@/queries';
import { useToastStore } from '@/app-shell/stores/toast';
import { filterIconCategories, iconByName } from '@/features/task/iconCatalog';
import type { Id, TaskColor } from '@/types';

const COLOR_OPTIONS: readonly { key: TaskColor; label: string }[] = [
  { key: 'forge-orange', label: 'Forge Orange' },
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
  const PreviewIcon = iconByName(currentIconName);
  const categories = useMemo(() => filterIconCategories(query), [query]);

  function cancel() {
    router.back();
  }

  async function save() {
    const result = await updateTask.mutateAsync({ id: taskId, patch: { icon: currentIconName, color: currentColor } });
    if (result.ok) {
      router.back();
    } else {
      showToast("Couldn't save that — try again.", 'warning');
    }
  }

  if (taskQuery.isLoading || !task) {
    return (
      <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
        <Skeleton height={40} />
        <Skeleton height={120} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={X} onPress={cancel} accessibilityLabel="Cancel" />
        <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
          Choose icon & color
        </Text>
        <Button label="Save" onPress={save} disabled={!changed} accessibilityLabel="Save" />
      </View>

      <View style={styles.previewRow}>
        <View style={[styles.previewCircle, { backgroundColor: ACCENTS[currentColor].base }]}>
          <PreviewIcon size={28} color="#fff" />
        </View>
        <Text style={[styles.previewName, { color: t.color.text }]}>{task.name}</Text>
      </View>

      <Input
        label="Search icons"
        value={query}
        onChangeText={setQuery}
        placeholder="Search icons"
        accessibilityLabel="Search icons"
        testID="icon-search"
      />

      {categories.length === 0 ? (
        <EmptyState icon={Search} headline={`No icons match "${query}."`} subcopy="Try a different word." />
      ) : (
        categories.map((cat) => (
          <View key={cat.heading} style={styles.category}>
            <Text style={[styles.categoryHeading, { color: t.color.text }]}>{cat.heading}</Text>
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
                    style={[styles.iconCell, { borderColor: selected ? t.accent.base : t.color.border }]}
                  >
                    <EntryIcon size={22} color={t.color.text} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}

      <Text style={[styles.categoryHeading, { color: t.color.text }]}>Color</Text>
      <View style={styles.colorRow}>
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
              {selected ? <Check size={18} color="#fff" /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Button label="Cancel" onPress={cancel} variant="ghost" accessibilityLabel="Cancel" />
        <Button label="Save" onPress={save} disabled={!changed} accessibilityLabel="Save" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  previewCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: 16, fontWeight: '600' },
  category: { gap: SPACE.s1 },
  categoryHeading: { fontSize: 14, fontWeight: '700' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
  iconCell: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', gap: SPACE.s2 },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: SPACE.s2, justifyContent: 'flex-end', marginTop: SPACE.s3 },
});
