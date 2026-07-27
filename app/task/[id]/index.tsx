/**
 * S20 — Manage Task Sheet    route: /task/:id
 * Owner: M4. Features: F3, F4, F7, F12, F23, F24.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S20)
 *
 * F7 snooze — see `src/features/task/snoozeSlot.ts` for the full non-negotiable contract
 * (SCHEMA.md §4.2, PRD §3.7): the action row has exactly two slots ("Duplicate" and ONE
 * snooze slot with three renderings), snooze takes no input, and there is no "Move to
 * another day" and no date picker anywhere on this screen.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlarmClock, Copy, Undo2, X } from 'lucide-react-native';

import { ACCENTS, SPACE, useTheme } from '@/theme';
import {
  Button,
  CalendarHeatmap,
  Card,
  Checkbox,
  IconButton,
  InlineRetryBanner,
  Input,
  OffDayToggle,
  Radio,
  Skeleton,
  StateChip,
  Switch,
  Tag,
  WeekdayPicker,
} from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { addDays, endOfMonth, startOfMonth, today as todayFn } from '@/lib/date';
import { isDue } from '@/domain';
import {
  useDuplicateTask,
  useLogDose,
  useLogState,
  useMarkOffDay,
  useSnoozeOccurrence,
  useTask,
  useTaskOccurrences,
  useToggleStep,
  useUndoSnooze,
  useUpdateTask,
} from '@/queries';
import { useToastStore } from '@/app-shell/stores/toast';
import { cadenceSummary } from '@/features/task/cadenceLabel';
import { todayLongLabel } from '@/features/task/dateLabel';
import { resolveSnoozeSlot } from '@/features/task/snoozeSlot';
import { iconByName } from '@/features/task/iconCatalog';
import type { ChipState, Id, Importance, Necessity, LocalDate, Weekday } from '@/types';

const IMPORTANCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Med' },
  { value: 'low', label: 'Low' },
];
const NECESSITY_OPTIONS = [
  { value: 'must-do', label: 'Must-do' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'optional', label: 'Optional' },
];

export default function S20ManageTaskSheet() {
  const t = useTheme();
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const taskId = id as Id;
  const goBack = useOriginAwareBack(ROUTES.today);
  const showToast = useToastStore((s) => s.show);

  const taskQuery = useTask(taskId);
  const today = todayFn();
  const yesterday = addDays(today, -1);
  const occTodayYesterdayQuery = useTaskOccurrences(taskId, { from: yesterday, to: today });

  const [monthAnchor, setMonthAnchor] = useState<LocalDate>(today);
  const monthFrom = startOfMonth(monthAnchor);
  const monthTo = endOfMonth(monthAnchor);
  const monthOccQuery = useTaskOccurrences(taskId, { from: monthFrom, to: monthTo });

  const updateTask = useUpdateTask();
  const logState = useLogState();
  const toggleStep = useToggleStep();
  const logDose = useLogDose();
  const markOffDay = useMarkOffDay();
  const duplicateTask = useDuplicateTask();
  const snoozeOccurrence = useSnoozeOccurrence();
  const undoSnooze = useUndoSnooze();

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [editingImportance, setEditingImportance] = useState(false);
  const [editingNecessity, setEditingNecessity] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, readonly Weekday[] | null> | null>(null);
  const [scheduleError, setScheduleError] = useState<string | undefined>();

  const task = taskQuery.data;

  const todayOccurrence = occTodayYesterdayQuery.data?.find((o) => o.date === today);
  const yesterdayOccurrence = occTodayYesterdayQuery.data?.find((o) => o.date === yesterday);
  const isDueYesterday = task ? isDue(task, yesterday) : false;
  const isDueToday = task ? isDue(task, today) : false;

  function goCelebrate(outcome: 'ideal' | 'fallback', xpAwarded: number, levelUp: boolean, badgesUnlocked: readonly string[]) {
    const badgeParam = !levelUp && badgesUnlocked.length > 0 ? `&badgeKey=${badgesUnlocked[0]}` : '';
    router.push(`/task/${taskId}/celebrate?variant=${outcome}&xp=${xpAwarded}&levelUp=${levelUp ? '1' : '0'}${badgeParam}&from=manage` as never);
  }

  async function onChipChange(chip: ChipState) {
    const result = await logState.mutateAsync({ taskId, date: today, chip });
    if (!result.ok) {
      showToast("Couldn't save that — try again.", 'warning');
      return;
    }
    if (result.value.celebrate === 'ideal' || result.value.celebrate === 'fallback') {
      goCelebrate(result.value.celebrate, result.value.xpAwarded, !!result.value.levelUp, result.value.badgesUnlocked);
    }
  }

  async function onToggleStep(stepId: Id) {
    const prevOutcome = todayOccurrence?.outcome;
    const result = await toggleStep.mutateAsync({ taskId, date: today, stepId });
    if (!result.ok) {
      showToast("Couldn't save that — try again.", 'warning');
      return;
    }
    const outcome = result.value.occurrence?.outcome;
    if ((outcome === 'ideal' || outcome === 'fallback') && outcome !== prevOutcome) {
      goCelebrate(outcome, result.value.xpAwarded, !!result.value.levelUp, result.value.badgesUnlocked);
    }
  }

  async function onNameBlur() {
    if (nameDraft === null || !task || nameDraft === task.name) {
      setNameDraft(null);
      return;
    }
    const result = await updateTask.mutateAsync({ id: taskId, patch: { name: nameDraft } });
    if (!result.ok) showToast("Couldn't save that — try again.", 'warning');
    setNameDraft(null);
  }

  async function onPickImportance(v: string) {
    setEditingImportance(false);
    const result = await updateTask.mutateAsync({ id: taskId, patch: { importance: v as Importance } });
    if (!result.ok) showToast("Couldn't save that — try again.", 'warning');
  }
  async function onPickNecessity(v: string) {
    setEditingNecessity(false);
    const result = await updateTask.mutateAsync({ id: taskId, patch: { necessity: v as Necessity } });
    if (!result.ok) showToast("Couldn't save that — try again.", 'warning');
  }

  async function onToggleSnoozable(value: boolean) {
    const result = await updateTask.mutateAsync({ id: taskId, patch: { snoozable: value } });
    if (!result.ok) showToast("Couldn't save that — try again.", 'warning');
  }

  async function onToggleOffDay(value: boolean) {
    const result = await markOffDay.mutateAsync({ date: today, taskId, mark: value });
    if (!result.ok) showToast("Couldn't save that — try again.", 'warning');
  }

  async function onDuplicate() {
    const result = await duplicateTask.mutateAsync(taskId);
    if (result.ok) {
      showToast('Duplicated — edit & save as new.', 'success');
      router.replace(`/task/${result.value}` as never);
    } else {
      showToast("Couldn't save that — try again.", 'warning');
    }
  }

  const snoozeSlot = task
    ? resolveSnoozeSlot({ todayOccurrence, yesterdayOccurrence, isDueYesterday, isDueToday, taskSnoozable: task.snoozable, yesterday })
    : { kind: 'snooze' as const, enabled: false, disabledReason: 'Loading…' };

  async function onSnoozeSlotPress() {
    if (snoozeSlot.kind === 'undo') {
      const result = await undoSnooze.mutateAsync({ taskId, date: snoozeSlot.sourceDate });
      if (!result.ok) showToast("Couldn't save that — try again.", 'warning');
      return;
    }
    if (!snoozeSlot.enabled) return;
    const result = await snoozeOccurrence.mutateAsync({ taskId, date: today });
    if (!result.ok) showToast("Couldn't save that — try again.", 'warning');
  }

  function onDelete() {
    router.push(`/task/${taskId}/delete?openedFrom=manage&origin=${from ?? ''}` as never);
  }

  function startScheduleEdit() {
    if (!task) return;
    const draft: Record<string, readonly Weekday[] | null> = {};
    for (const s of task.idealSteps) draft[s.id] = s.dueWeekdays;
    setScheduleDraft(draft);
    setEditingSchedule(true);
  }

  async function saveSchedule() {
    if (!task || !scheduleDraft) return;
    const parentDays: readonly Weekday[] =
      task.cadence?.kind === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : task.cadence?.kind === 'specific-weekdays' ? task.cadence.weekdays : [];
    const offending = parentDays.filter((d) => !task.idealSteps.some((s) => (scheduleDraft[s.id] ?? null) === null || scheduleDraft[s.id]!.includes(d)));
    if (offending.length > 0) {
      setScheduleError(`No ideal step is due on the highlighted day${offending.length > 1 ? 's' : ''}. Turn at least one back on.`);
      return;
    }
    setScheduleError(undefined);
    const newSteps = [...task.idealSteps.map((s) => ({ ...s, dueWeekdays: scheduleDraft[s.id] ?? null })), ...task.fallbackSteps];
    const result = await updateTask.mutateAsync({ id: taskId, patch: {}, steps: newSteps });
    if (result.ok) setEditingSchedule(false);
    else showToast("Couldn't save that — try again.", 'warning');
  }

  if (taskQuery.isLoading || !task) {
    return (
      <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content} testID="s20-loading">
        <Skeleton height={32} />
        <Skeleton height={120} />
        <Skeleton height={200} />
      </ScrollView>
    );
  }

  const Icon = iconByName(task.icon);
  const isMultiDose = task.dosesPerDay > 1;

  const monthLabel = new Date(Number(monthFrom.slice(0, 4)), Number(monthFrom.slice(5, 7)) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const isEmptyHistory = (monthOccQuery.data ?? []).every((o) => o.chipState === null && o.outcome !== 'off');
  const heatmapDays = (monthOccQuery.data ?? []).map((o) => ({
    date: o.date,
    dayOfMonth: Number(o.date.slice(8, 10)),
    outcome: isEmptyHistory && o.outcome === 'missed' ? ('not-due' as const) : o.outcome,
  }));

  const parentDays: readonly Weekday[] =
    task.cadence?.kind === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : task.cadence?.kind === 'specific-weekdays' ? task.cadence.weekdays : [];
  const showScheduleEditor = (task.cadence?.kind === 'daily' || task.cadence?.kind === 'specific-weekdays') && task.idealSteps.length > 0;

  return (
    <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={X} onPress={goBack} accessibilityLabel="Close" />
        <Pressable
          onPress={() => router.push(`/task/${taskId}/icon` as never)}
          accessibilityRole="button"
          accessibilityLabel="Change icon and color"
          testID="s20-icon-avatar"
          style={[styles.avatar, { backgroundColor: ACCENTS[task.color].base }]}
        >
          <Icon size={22} color={t.color.textOnAccent} />
        </Pressable>
        <View style={styles.nameCol}>
          <Input label="Task name" value={nameDraft ?? task.name} onChangeText={setNameDraft} accessibilityLabel="Task name" testID="s20-name-input" />
          {nameDraft !== null && nameDraft !== task.name ? (
            <Button label="Save name" onPress={onNameBlur} variant="ghost" accessibilityLabel="Save name" testID="s20-save-name" />
          ) : null}
          <View style={styles.tagRow}>
            <Tag label={cadenceSummary(task)} />
            {editingImportance ? (
              <Radio
                label="Importance"
                value={task.importance}
                options={IMPORTANCE_OPTIONS}
                onChange={onPickImportance}
                testID="s20-importance-picker"
              />
            ) : (
              <Tag
                label={task.importance ? IMPORTANCE_OPTIONS.find((o) => o.value === task.importance)?.label ?? '' : 'Importance'}
                accessibilityLabel={`Importance, ${task.importance ?? 'not set'}. Double tap to change.`}
              />
            )}
            {editingNecessity ? (
              <Radio
                label="Necessity"
                value={task.necessity}
                options={NECESSITY_OPTIONS}
                onChange={onPickNecessity}
                testID="s20-necessity-picker"
              />
            ) : (
              <Tag
                label={task.necessity ? NECESSITY_OPTIONS.find((o) => o.value === task.necessity)?.label ?? '' : 'Necessity'}
                accessibilityLabel={`Necessity, ${task.necessity ?? 'not set'}. Double tap to change.`}
              />
            )}
          </View>
          {!editingImportance || !editingNecessity ? (
            <View style={styles.tagEditButtons}>
              {!editingImportance ? (
                <Button label="Edit importance" onPress={() => setEditingImportance(true)} variant="ghost" accessibilityLabel="Edit importance" />
              ) : null}
              {!editingNecessity ? (
                <Button label="Edit necessity" onPress={() => setEditingNecessity(true)} variant="ghost" accessibilityLabel="Edit necessity" />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {!task.isAsNeeded ? (
        <Card accessibilityLabel="Today's occurrence">
          <Text style={[styles.dateLabel, { color: t.color.text }]}>{todayLongLabel(today)}</Text>
          <Text style={[styles.ruleLine, { color: t.color.textMuted }]}>Steps set the state automatically — tap a state to override.</Text>

          {isMultiDose ? (
            <>
              <StateChip
                value={todayOccurrence?.chipState ?? null}
                onChange={onChipChange}
                accessibilityLabel="Whole day"
                testID="s20-day-chip"
              />
              <Text style={[styles.ruleLine, { color: t.color.textMuted }]}>
                Doses set the day's state automatically once both are handled — tap the day chip to override (Fallback/Skip), the same F3 mechanic
                as any other task.
              </Text>
              <Text style={[styles.ruleLine, { color: t.color.textMuted }]}>
                {todayOccurrence?.dosesCompleted ?? 0} of {task.dosesPerDay} doses done — the day isn&apos;t logged until both are handled, unless
                you override it with the day chip above.
              </Text>
              <View style={styles.doseRow}>
                <Checkbox
                  checked={(todayOccurrence?.dosesCompleted ?? 0) >= 1}
                  onToggle={() =>
                    logDose.mutateAsync({ taskId, date: today, dosesCompleted: (todayOccurrence?.dosesCompleted ?? 0) >= 1 ? 0 : 1 })
                  }
                  label="Morning dose · 9:00a"
                />
                <Checkbox
                  checked={(todayOccurrence?.dosesCompleted ?? 0) >= 2}
                  onToggle={() =>
                    logDose.mutateAsync({
                      taskId,
                      date: today,
                      dosesCompleted: (todayOccurrence?.dosesCompleted ?? 0) >= 2 ? 1 : 2,
                    })
                  }
                  label="Evening dose · 9:00p"
                />
              </View>
            </>
          ) : (
            <>
              <StateChip value={todayOccurrence?.chipState ?? null} onChange={onChipChange} accessibilityLabel="Today's state" testID="s20-chip" />
              {task.idealSteps.map((step) => {
                const dueToday = todayOccurrence?.dueIdealStepIds.includes(step.id) ?? false;
                return (
                  <Checkbox
                    key={step.id}
                    checked={todayOccurrence?.completedStepIds.includes(step.id) ?? false}
                    onToggle={() => onToggleStep(step.id)}
                    label={step.text}
                    disabled={!dueToday}
                    caption={dueToday ? undefined : 'Not due today'}
                  />
                );
              })}
              {task.fallbackSteps[0] ? (
                <View style={styles.fallbackCard}>
                  <Text style={{ color: t.color.textMuted }}>Fallback — {task.fallbackSteps[0].text}. The low bar on a hard day.</Text>
                  <Button label="Log fallback" onPress={() => onChipChange('fallback')} variant="secondary" accessibilityLabel="Log fallback" />
                </View>
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      <OffDayToggle
        value={todayOccurrence?.outcome === 'off'}
        onValueChange={onToggleOffDay}
        label="Off today (this task only)"
        helper="Marks just this task's day off — your other tasks, and the whole-day toggle on Today, are unaffected. Turn it off to restore what was logged."
      />

      <View style={styles.switchRow}>
        <Text style={{ color: t.color.text, fontWeight: '600' }}>Snoozable</Text>
        <Switch value={task.snoozable} onValueChange={onToggleSnoozable} accessibilityLabel="Snoozable" testID="s20-snoozable-switch" />
      </View>

      {showScheduleEditor ? (
        <View style={styles.subStepRegion}>
          <Button
            label="Edit step schedule"
            onPress={() => (editingSchedule ? setEditingSchedule(false) : startScheduleEdit())}
            variant="secondary"
            accessibilityLabel="Edit step schedule"
          />
          {editingSchedule && scheduleDraft ? (
            <View style={styles.scheduleEditor}>
              {task.idealSteps.map((step) => (
                <View key={step.id} style={styles.scheduleRow}>
                  <Text style={{ color: t.color.text }}>{step.text}</Text>
                  <WeekdayPicker
                    selected={scheduleDraft[step.id] ?? parentDays}
                    onChange={(sel) => setScheduleDraft((prev) => ({ ...(prev ?? {}), [step.id]: sel }))}
                    disabledDays={([1, 2, 3, 4, 5, 6, 7] as Weekday[]).filter((d) => !parentDays.includes(d))}
                    accessibilityLabel={`${step.text} schedule`}
                  />
                </View>
              ))}
              {scheduleError ? (
                <Text accessibilityRole="alert" style={{ color: t.color.danger }}>
                  {scheduleError}
                </Text>
              ) : null}
              <Button label="Save schedule" onPress={saveSchedule} accessibilityLabel="Save schedule" />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <Button
          label="Duplicate"
          onPress={onDuplicate}
          variant="secondary"
          icon={<Copy size={16} color={t.color.text} />}
          accessibilityLabel="Duplicate"
          testID="s20-duplicate"
        />
        {snoozeSlot.kind === 'undo' ? (
          <Button
            label="Undo snooze"
            onPress={onSnoozeSlotPress}
            variant="secondary"
            icon={<Undo2 size={16} color={t.color.text} />}
            accessibilityLabel="Undo snooze"
            testID="s20-undo-snooze"
          />
        ) : (
          <Button
            label="Snooze"
            onPress={onSnoozeSlotPress}
            variant="secondary"
            disabled={!snoozeSlot.enabled}
            icon={<AlarmClock size={16} color={t.color.text} />}
            accessibilityLabel={snoozeSlot.enabled ? 'Snooze' : `Snooze, disabled. ${snoozeSlot.disabledReason ?? ''}`}
            testID="s20-snooze"
          />
        )}
      </View>

      <Text accessibilityRole="header" style={[styles.sectionHeading, { color: t.color.text }]}>
        Calendar
      </Text>
      {monthOccQuery.isError ? (
        <InlineRetryBanner message="Couldn't load your history — try again." onRetry={() => monthOccQuery.refetch()} />
      ) : (
        <CalendarHeatmap
          days={heatmapDays}
          monthLabel={monthLabel}
          onPrevMonth={() => setMonthAnchor(addDays(startOfMonth(monthAnchor), -1))}
          onNextMonth={() => setMonthAnchor(addDays(endOfMonth(monthAnchor), 1))}
          statLine={
            isEmptyHistory
              ? undefined
              : `${heatmapDays.filter((d) => d.outcome === 'ideal' || d.outcome === 'fallback').length} of ${
                  heatmapDays.filter((d) => d.outcome !== 'not-due' && d.outcome !== 'pending').length
                } days shown up`
          }
          emptyHistoryCaption={isEmptyHistory ? 'Your history will fill in as you log days.' : undefined}
          accessibilityLabel={`Calendar, ${monthLabel}`}
        />
      )}

      <Button label="Delete routine" onPress={onDelete} variant="danger" accessibilityLabel="Delete routine" testID="s20-delete" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s2 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nameCol: { flex: 1, gap: SPACE.s1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s1 },
  tagEditButtons: { flexDirection: 'row', flexWrap: 'wrap' },
  dateLabel: { fontSize: 16, fontWeight: '600' },
  ruleLine: { fontSize: 13, lineHeight: 18 },
  doseRow: { gap: SPACE.s1 },
  fallbackCard: { gap: SPACE.s1, marginTop: SPACE.s1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subStepRegion: { gap: SPACE.s2 },
  scheduleEditor: { gap: SPACE.s2 },
  scheduleRow: { gap: SPACE.s1 },
  actionsRow: { flexDirection: 'row', gap: SPACE.s2 },
  sectionHeading: { fontSize: 16, fontWeight: '700' },
});
