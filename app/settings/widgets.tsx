/**
 * S46 — Widgets    route: /settings/widgets
 * Owner: M7. Features: F21.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S46)
 */
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useToastStore } from '@/app-shell';
import { S46_COPY } from '@/features/settings/copy';
import { SettingsHeader } from '@/features/settings/SettingsHeader';
import { useSettings, useTasks, useUpdateSettings } from '@/queries';
import { initNotificationsBridge } from '@/services/notifications';
import { initWidgetsBridge } from '@/services/widgets';
import { SPACE, useTheme } from '@/theme';
import { Button, Card, ProgressRing, Radio, Select, Skeleton, StateChip } from '@/ui';
import type { Id, WidgetConfig, WidgetSize } from '@/types';

function configFor(widgets: readonly WidgetConfig[], size: WidgetSize): WidgetConfig {
  return widgets.find((w) => w.size === size) ?? { size, mode: 'smart-next-due', fixedTaskId: null };
}

export default function S46Widgets() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const tasksQuery = useTasks();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);

  const [expanded, setExpanded] = useState<WidgetSize | null>(null);
  const [draftMode, setDraftMode] = useState<'fixed-task' | 'smart-next-due'>('smart-next-due');
  const [draftTaskId, setDraftTaskId] = useState<Id | null>(null);
  const [saving, setSaving] = useState<WidgetSize | null>(null);

  // Review pass 1, blocking item 1: idempotent, safe on every M7-owned screen's mount — S46
  // saves widget configs no snapshot is otherwise ever published for.
  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
  }, []);

  function handleBack() {
    router.push('/settings' as Href);
  }

  function toggleExpand(size: WidgetSize) {
    if (expanded === size) {
      setExpanded(null);
      return;
    }
    const current = configFor(settingsQuery.data?.widgets ?? [], size);
    setDraftMode(current.mode);
    setDraftTaskId(current.fixedTaskId);
    setExpanded(size);
  }

  async function handleSave(size: WidgetSize) {
    const existing = settingsQuery.data?.widgets ?? [];
    const nextConfig: WidgetConfig = { size, mode: draftMode, fixedTaskId: draftMode === 'fixed-task' ? draftTaskId : null };
    const nextWidgets = [...existing.filter((w) => w.size !== size), nextConfig];

    setSaving(size);
    const result = await updateSettings.mutateAsync({ widgets: nextWidgets });
    setSaving(null);

    if (!result.ok) {
      showToast(S46_COPY.errorToast, 'warning');
      return;
    }
    showToast(S46_COPY.savedToast, 'success');
  }

  if (settingsQuery.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: t.color.bg }]}>
        <SettingsHeader title={S46_COPY.title} onBack={handleBack} />
        <View style={styles.content}>
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
        </View>
      </View>
    );
  }

  const widgets = settingsQuery.data?.widgets ?? [];
  const taskOptions = (tasksQuery.data ?? []).map((task) => ({ value: task.id, label: task.name }));

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <SettingsHeader title={S46_COPY.title} onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {S46_COPY.gallery.map((entry) => {
          const isOpen = expanded === entry.size;
          return (
            <Card key={entry.size}>
              <Pressable
                onPress={() => toggleExpand(entry.size)}
                accessibilityRole="button"
                accessibilityLabel={`${entry.label} widget, ${isOpen ? 'expanded' : 'collapsed'}`}
                style={styles.galleryRow}
              >
                <View style={styles.previewFrame}>
                  {entry.size === 'small-today' ? (
                    <ProgressRing percent={60} size={28} strokeWidth={4} accessibilityLabel={entry.preview} />
                  ) : entry.size === 'small-one-task' ? (
                    <StateChip value="todo" onChange={() => {}} disabled variant="compact" accessibilityLabel={entry.preview} />
                  ) : (
                    <LayoutGrid size={20} color={t.color.textMuted} />
                  )}
                </View>
                <View style={styles.galleryText}>
                  <Text style={[styles.galleryLabel, { color: t.color.text }]}>{entry.label}</Text>
                  <Text style={[styles.gallerySub, { color: t.color.textMuted }]}>{entry.preview}</Text>
                </View>
                {isOpen ? <ChevronDown size={18} color={t.color.textMuted} /> : <ChevronRight size={18} color={t.color.textMuted} />}
              </Pressable>

              {isOpen ? (
                <View style={styles.panel}>
                  <Radio
                    label="Widget content"
                    value={draftMode}
                    onChange={(v) => setDraftMode(v as 'fixed-task' | 'smart-next-due')}
                    options={[
                      { value: 'fixed-task', label: S46_COPY.fixedTask },
                      { value: 'smart-next-due', label: S46_COPY.smartNextDue },
                    ]}
                  />
                  {draftMode === 'fixed-task' ? (
                    <Select
                      label={S46_COPY.fixedTask}
                      value={draftTaskId}
                      options={taskOptions}
                      onChange={(v) => setDraftTaskId(v as Id)}
                    />
                  ) : (
                    <Text style={[styles.helper, { color: t.color.textMuted }]}>{S46_COPY.smartHelper}</Text>
                  )}
                  <Button
                    label={S46_COPY.save}
                    onPress={() => handleSave(entry.size)}
                    loading={saving === entry.size}
                    accessibilityLabel={S46_COPY.save}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}

        <Text style={[styles.footer, { color: t.color.textDim }]}>{S46_COPY.footer}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  galleryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  previewFrame: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  galleryText: { flex: 1, gap: 2 },
  galleryLabel: { fontSize: 16, fontWeight: '600' },
  gallerySub: { fontSize: 13 },
  panel: { gap: SPACE.s2, marginTop: SPACE.s2 },
  helper: { fontSize: 14, lineHeight: 20 },
  footer: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
