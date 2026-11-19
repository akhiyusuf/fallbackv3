/** S46 — Widgets. One grouped list (D7); each widget is configured in a sheet (D3). */
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { LayoutGrid, ListChecks, Target, type LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { useToastStore } from '@/app-shell';
import { S46_COPY } from '@/features/settings/copy';
import { WidgetPreviews } from '@/features/widgets/WidgetPreviews';
import { useSettings, useTasks, useUpdateSettings } from '@/queries';
import { initNotificationsBridge } from '@/services/notifications';
import { initWidgetsBridge } from '@/services/widgets';
import { FONT_SIZE, useTheme } from '@/theme';
import { ButtonPair, Dialog, ListGroup, ListRow, Radio, Screen, Select, Skeleton } from '@/ui';
import type { Id, WidgetConfig, WidgetSize } from '@/types';
import { Text } from '@/ui/AppText';

const ICONS: Record<string, LucideIcon> = { 'small-today': Target, 'small-one-task': ListChecks, 'medium-up-next': LayoutGrid };

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

  const [editing, setEditing] = useState<WidgetSize | null>(null);
  const [draftMode, setDraftMode] = useState<'fixed-task' | 'smart-next-due'>('smart-next-due');
  const [draftTaskId, setDraftTaskId] = useState<Id | null>(null);

  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
  }, []);

  function handleBack() {
    router.push('/settings' as Href);
  }

  const widgets = settingsQuery.data?.widgets ?? [];
  const tasks = tasksQuery.data ?? [];
  const taskOptions = tasks.map((task) => ({ value: task.id, label: task.name }));

  function open(size: WidgetSize) {
    const current = configFor(widgets, size);
    setDraftMode(current.mode);
    // A fixed task that is in Recently deleted is not in the list: show it as not chosen, so Save is not offered for a task the picker cannot show.
    setDraftTaskId(tasks.some((task) => task.id === current.fixedTaskId) ? current.fixedTaskId : null);
    setEditing(size);
  }

  async function handleSave() {
    if (!editing) return;
    const nextConfig: WidgetConfig = { size: editing, mode: draftMode, fixedTaskId: draftMode === 'fixed-task' ? draftTaskId : null };
    const result = await updateSettings.mutateAsync({ widgets: [...widgets.filter((w) => w.size !== editing), nextConfig] });
    if (!result.ok) {
      showToast(S46_COPY.errorToast, 'warning');
      return;
    }
    setEditing(null);
    showToast(S46_COPY.savedToast, 'success');
  }

  if (settingsQuery.isLoading) {
    return (
      <Screen title={S46_COPY.title} onBack={handleBack}>
        <Skeleton height={200} radius={16} />
      </Screen>
    );
  }

  const editingEntry = S46_COPY.gallery.find((g) => g.size === editing);

  return (
    <Screen title={S46_COPY.title} onBack={handleBack}>
      <WidgetPreviews widgets={widgets} />
      <ListGroup title="What each one shows" footer={S46_COPY.footer}>
        {S46_COPY.gallery.map((entry) => {
          const config = configFor(widgets, entry.size);
          const value = config.mode === 'fixed-task' ? (tasks.find((tk) => tk.id === config.fixedTaskId)?.name ?? S46_COPY.fixedTask) : S46_COPY.smartNextDue;
          return (
            <ListRow
              key={entry.size}
              icon={ICONS[entry.size]}
              label={entry.label}
              value={entry.size === 'small-today' ? "Today's count" : value}
              onPress={() => open(entry.size)}
              chevron={false}
              accessibilityLabel={`${entry.label} widget. Opens its settings`}
            />
          );
        })}
      </ListGroup>

      <Dialog visible={!!editing} onClose={() => setEditing(null)} title={editingEntry?.label ?? S46_COPY.title} accessibilityLabel={editingEntry?.label ?? S46_COPY.title}>
        <Radio
          label="Shows"
          value={draftMode}
          onChange={(v) => setDraftMode(v as 'fixed-task' | 'smart-next-due')}
          options={[
            { value: 'smart-next-due', label: S46_COPY.smartNextDue },
            { value: 'fixed-task', label: S46_COPY.fixedTask },
          ]}
        />
        {draftMode === 'fixed-task' ? (
          <Select label="Task" value={draftTaskId} options={taskOptions} onChange={(v) => setDraftTaskId(v as Id)} placeholder="Choose a task" />
        ) : (
          <Text style={[styles.helper, { color: t.color.textMuted }]}>{S46_COPY.smartHelper}</Text>
        )}
        <ButtonPair
          primary={{ label: S46_COPY.save, onPress: () => void handleSave(), loading: updateSettings.isPending, disabled: draftMode === 'fixed-task' && !draftTaskId }}
          secondary={{ label: 'Cancel', onPress: () => setEditing(null) }}
        />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({ helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 } });
