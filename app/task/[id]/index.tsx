/**
 * S20 — the task screen (DESIGN_DECISIONS D5).
 * A pushed page: back chevron, colored icon circle, the name as a title, and a
 * "···" menu with Rename / Change icon / Duplicate / Delete. Logging uses the
 * shared log control (D1); every confirmation and editor is a bottom sheet (D3).
 * To-dos and untracked events only show what applies to them.
 */
import { play } from '@/services/sfx';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlarmClock, CalendarDays, CircleStop, LifeBuoy, Copy, ListTodo, MoreHorizontal, Palette, PencilLine, RotateCcw, StickyNote, Trash2, Undo2 } from 'lucide-react-native';
import { format } from 'date-fns';

import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import {
  Button,
  ButtonPair,
  CalendarHeatmap,
  Card,
  Checkbox,
  ConfirmSheet,
  Dialog,
  EmptyLine,
  IconButton,
  InlineRetryBanner,
  Input,
  ListGroup,
  ListRow,
  LogButtons,
  LogControl,
  MenuSheet,
  Radio,
  Screen,
  SectionHeading,
  Skeleton,
  Switch,
  TaskIcon,
  WeekdayPicker,
  TimeField,
} from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { addDays, endOfMonth, now, parseLocalDate, startOfMonth, today as todayFn } from '@/lib/date';
import { isDue, perTaskConsistency } from '@/domain';
import {
  useConsistency,
  useDuplicateTask,
  useEndTask,
  useLogDose,
  useLogState,
  useMarkOffDay,
  useSnoozeOccurrence,
  useStartAgain,
  useTask,
  useTaskOccurrences,
  useToggleStep,
  useUndoSnooze,
  useUpdateTask,
} from '@/queries';
import { useToastStore } from '@/app-shell/stores/toast';
import { formatTimeOfDay } from '@/features/browse/format';
import { taskColor } from '@/features/browse/resolveIcon';
import { cadenceSummary } from '@/features/task/cadenceLabel';
import { dayLongLabel } from '@/features/task/dateLabel';
import { DeleteTaskSheet, TYPE_NOUN } from '@/features/task/DeleteTaskSheet';
import { DeletedTaskNotice, GoneTaskNotice } from '@/features/task/DeletedTaskNotice';
import { IMPORTANCE_OPTIONS, NECESSITY_OPTIONS, SAVE_FAILED } from '@/features/task/formShared';
import { iconByName } from '@/features/task/iconCatalog';
import { useLogFeedback } from '@/features/task/logFeedback';
import { resolveSnoozeSlot } from '@/features/task/snoozeSlot';
import { PlanTiles, metaParts } from '@/features/task/TaskDetails';
import { TaskHero } from '@/features/task/TaskHero';
import { useDayTick } from '@/features/today/useTodayRows';
import { PriorityPlaceRow } from '@/features/priorities/PriorityPlaceRow';
import { formatDateValue } from '@/ui';
import type { ChipState, Id, Importance, LocalDate, Necessity, Occurrence, Weekday } from '@/types';
import { Text } from '@/ui/AppText';

const ALL_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const TYPE_TITLE = { routine: 'Routine', event: 'Event', course: 'Course', todo: 'To-do' } as const;

export default function S20ManageTask() {
  const t = useTheme();
  const router = useRouter();
  const { id, from, confirmDelete } = useLocalSearchParams<{ id: string; from?: string; confirmDelete?: string }>();
  const taskId = id as Id;
  const goBack = useOriginAwareBack(ROUTES.today);
  const showToast = useToastStore((s) => s.show);
  const logFeedback = useLogFeedback();

  useDayTick();
  const taskQuery = useTask(taskId);
  const today = todayFn();
  const yesterday = addDays(today, -1);
  const occTodayYesterdayQuery = useTaskOccurrences(taskId, { from: yesterday, to: today });

  const [monthAnchor, setMonthAnchor] = useState<LocalDate>(today);
  const monthFrom = startOfMonth(monthAnchor);
  const monthTo = endOfMonth(monthAnchor);
  const monthOccQuery = useTaskOccurrences(taskId, { from: monthFrom, to: monthTo });
  const lifetimeConsistencyQuery = useConsistency({ scope: 'per-task', window: 'all-time', taskId });
  const [popoverDate, setPopoverDate] = useState<LocalDate | null>(null);

  const updateTask = useUpdateTask();
  const logState = useLogState();
  const toggleStep = useToggleStep();
  const logDose = useLogDose();
  const markOffDay = useMarkOffDay();
  const duplicateTask = useDuplicateTask();
  const snoozeOccurrence = useSnoozeOccurrence();
  const undoSnooze = useUndoSnooze();
  const endTask = useEndTask();
  const startAgain = useStartAgain();

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  // Set the moment a delete is confirmed: the screen is on its way out, so it must not flash the "deleted" notice.
  const [leaving, setLeaving] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, readonly Weekday[] | null>>({});
  const [scheduleError, setScheduleError] = useState<string | undefined>();

  useEffect(() => {
    if (confirmDelete === '1') setDeleteOpen(true);
  }, [confirmDelete]);

  const task = taskQuery.data;
  const todayOccurrence = occTodayYesterdayQuery.data?.find((o) => o.date === today);
  // Pushed here from yesterday, beside today's own (additive push): shown and logged on its own.
  const pushedToday = occTodayYesterdayQuery.data?.find((o) => o.date === today && o.pushedFrom !== undefined && o !== todayOccurrence);
  const yesterdayOccurrence = occTodayYesterdayQuery.data?.find((o) => o.date === yesterday);
  const isDueYesterday = task ? isDue(task, yesterday) : false;
  const isDueToday = task ? isDue(task, today) : false;

  function fail() {
    showToast(SAVE_FAILED, 'warning');
  }

  // A second tap before the first save has come back must not log twice (two sounds, two toasts).
  const logging = useRef(new Set<string>());
  async function guarded(key: string, run: () => Promise<void>) {
    if (logging.current.has(key)) return;
    logging.current.add(key);
    try {
      await run();
    } catch {
      fail();
    } finally {
      logging.current.delete(key);
    }
  }

  function onChipChange(chip: ChipState, isUndo = false): Promise<void> {
    return guarded('own', async () => {
      const previous: ChipState = todayOccurrence?.chipState ?? 'todo';
      const result = await logState.mutateAsync({ taskId, date: today, chip });
      if (!result.ok) return fail();
      if (isUndo) return showToast('Undone.', 'neutral');
      logFeedback(chip, result.value, chip === 'todo' ? undefined : () => void onChipChange(previous, true));
    });
  }

  function onPushedChange(chip: ChipState, isUndo = false): Promise<void> {
    return guarded('pushed', async () => {
      if (!pushedToday?.pushedFrom) return;
      const previous: ChipState = pushedToday.chipState ?? 'todo';
      const result = await logState.mutateAsync({ taskId, date: today, chip, pushedFrom: pushedToday.pushedFrom });
      if (!result.ok) return fail();
      if (isUndo) return showToast('Undone.', 'neutral');
      logFeedback(chip, result.value, chip === 'todo' ? undefined : () => void onPushedChange(previous, true));
    });
  }

  async function onDoseChange(index: number, chip: ChipState) {
    const current = todayOccurrence?.dosesCompleted ?? 0;
    const dosesCompleted = chip === 'todo' ? Math.min(current, index) : Math.max(current, index + 1);
    const result = await logDose.mutateAsync({ taskId, date: today, dosesCompleted });
    if (!result.ok) fail();
  }

  async function onToggleStep(stepId: Id) {
    const prevOutcome = todayOccurrence?.outcome;
    const result = await toggleStep.mutateAsync({ taskId, date: today, stepId });
    if (!result.ok) return fail();
    const outcome = result.value.occurrence?.outcome;
    if ((outcome === 'ideal' || outcome === 'fallback') && outcome !== prevOutcome) {
      logFeedback(outcome === 'ideal' ? 'done' : 'fallback', result.value);
    }
  }

  async function saveName() {
    if (!task) return;
    const next = nameDraft.trim();
    if (next.length === 0 || next === task.name) return setRenameOpen(false);
    try {
      const result = await updateTask.mutateAsync({ id: taskId, patch: { name: next } });
      if (!result.ok) return fail();
    } catch {
      return fail();
    }
    setRenameOpen(false);
  }

  async function patch(p: Parameters<typeof updateTask.mutateAsync>[0]['patch']) {
    const result = await updateTask.mutateAsync({ id: taskId, patch: p });
    if (!result.ok) fail();
  }

  async function onToggleOffDay(value: boolean) {
    const result = await markOffDay.mutateAsync({ date: today, taskId, mark: value });
    if (!result.ok) fail();
  }

  // A second tap before the sheet or button re-renders as busy must not run the change twice.
  const changing = useRef(false);

  async function onEnd() {
    if (changing.current) return;
    changing.current = true;
    try {
      const result = await endTask.mutateAsync(taskId).catch(() => ({ ok: false as const }));
      setEndOpen(false);
      if (result.ok) showToast(END_COPY.endedToast, 'neutral');
      else fail();
    } finally {
      changing.current = false;
    }
  }

  async function onStartAgain() {
    if (changing.current) return;
    changing.current = true;
    try {
      const result = await startAgain.mutateAsync(taskId).catch(() => ({ ok: false as const }));
      if (result.ok) showToast(END_COPY.startedToast, 'success');
      else fail();
    } finally {
      changing.current = false;
    }
  }

  // A second tap before the first copy is made must not make a second copy.
  const duplicating = useRef(false);
  async function onDuplicate() {
    if (duplicating.current) return;
    duplicating.current = true;
    try {
      const result = await duplicateTask.mutateAsync(taskId);
      if (result.ok) {
        showToast("Duplicated. You're now on the copy.", 'success');
        router.replace(`/task/${result.value}` as never);
      } else fail();
    } catch {
      fail();
    } finally {
      duplicating.current = false;
    }
  }

  const snoozeSlot = task
    ? resolveSnoozeSlot({ todayOccurrence, yesterdayOccurrence, isDueYesterday, isDueToday, taskSnoozable: task.snoozable, yesterday })
    : { kind: 'snooze' as const, enabled: false, disabledReason: 'Loading…' };

  async function onSnoozeSlotPress() {
    if (snoozeSlot.kind === 'undo') {
      const result = await undoSnooze.mutateAsync({ taskId, date: snoozeSlot.sourceDate });
      if (!result.ok) fail();
      else showToast('Push undone.', 'neutral');
      return;
    }
    if (!snoozeSlot.enabled) return;
    const result = await snoozeOccurrence.mutateAsync({ taskId, date: today });
    if (!result.ok) fail();
    else {
      play('snooze');
      showToast('Pushed to tomorrow.', 'neutral', {
        action: {
          label: 'Undo',
          onPress: () =>
            void (async () => {
              const undone = await undoSnooze.mutateAsync({ taskId, date: today });
              if (!undone.ok) fail();
              else showToast('Back on today.', 'neutral');
            })(),
        },
      });
    }
  }

  function openSchedule() {
    if (!task) return;
    const draft: Record<string, readonly Weekday[] | null> = {};
    for (const s of task.idealSteps) draft[s.id] = s.dueWeekdays;
    setScheduleDraft(draft);
    setScheduleError(undefined);
    setScheduleOpen(true);
  }

  if (!taskQuery.isLoading && taskQuery.data === null) return <GoneTaskNotice onBack={goBack} />;

  if (taskQuery.isLoading || !task) {
    return (
      <Screen onBack={goBack} testID="s20-loading">
        <Skeleton height={32} />
        <Skeleton height={160} radius={16} />
        <Skeleton height={200} radius={16} />
      </Screen>
    );
  }

  if (task.deletedAt && !leaving) return <DeletedTaskNotice taskId={taskId} name={task.name} onBack={goBack} />;

  const Icon = iconByName(task.icon);
  const isTodo = task.type === 'todo';
  const isNote = isTodo && task.isNote;
  const noun = isNote ? 'note' : TYPE_NOUN[task.type];
  const isTrackedTask = !isTodo && (task.idealSteps.length > 0 || task.fallbackSteps.length > 0);
  const isMultiDose = task.dosesPerDay > 1;
  const parentDays: readonly Weekday[] =
    task.cadence?.kind === 'daily' ? ALL_DAYS : task.cadence?.kind === 'specific-weekdays' ? task.cadence.weekdays : [];
  const showScheduleEditor = isTrackedTask && parentDays.length > 1 && task.idealSteps.length > 1;
  // Something that keeps coming round can be ended: a routine, a repeating event, a course.
  const canEnd = !isTodo && !task.isAsNeeded && !(task.type === 'event' && task.eventDate !== null);
  const endedOn = task.endedOn ?? null;

  async function saveSchedule() {
    if (!task) return;
    const offending = parentDays.filter((d) => !task.idealSteps.some((s) => (scheduleDraft[s.id] ?? null) === null || scheduleDraft[s.id]!.includes(d)));
    if (offending.length > 0) {
      setScheduleError('At least one step has to be due on every day this runs.');
      return;
    }
    const newSteps = [...task.idealSteps.map((s) => ({ ...s, dueWeekdays: scheduleDraft[s.id] ?? null })), ...task.fallbackSteps];
    try {
      const result = await updateTask.mutateAsync({ id: taskId, patch: {}, steps: newSteps });
      if (result.ok) setScheduleOpen(false);
      else fail();
    } catch {
      fail();
    }
  }

  const monthLabel = new Date(Number(monthFrom.slice(0, 4)), Number(monthFrom.slice(5, 7)) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isEmptyHistory =
    lifetimeConsistencyQuery.data !== undefined && lifetimeConsistencyQuery.data.denominator === 0 && lifetimeConsistencyQuery.data.breakdown.off === 0;
  const heatmapDays = (monthOccQuery.data ?? []).map((o) => ({
    date: o.date,
    dayOfMonth: Number(o.date.slice(8, 10)),
    outcome: isEmptyHistory && o.outcome === 'missed' ? ('not-due' as const) : o.outcome,
  }));
  const monthConsistency = perTaskConsistency({ taskId, occurrences: monthOccQuery.data ?? [], window: { from: monthFrom, to: monthTo }, today });
  const statLine =
    isEmptyHistory || monthConsistency.percent === null
      ? undefined
      : `Showed up ${monthConsistency.numerator} of ${monthConsistency.denominator} days (${monthConsistency.percent}%)`;

  const when = [
    task.eventDate ? formatDateValue(task.eventDate) : null,
    task.timeOfDay ? formatTimeOfDay(task.timeOfDay) : null,
    task.type === 'course' && task.startDate && task.endDate ? `${formatDateValue(task.startDate)} to ${formatDateValue(task.endDate)}` : null,
  ];
  const dosesDone = todayOccurrence?.dosesCompleted ?? 0;
  const dueNow = !!todayOccurrence && todayOccurrence.outcome !== 'not-due';
  const isOffToday = todayOccurrence?.outcome === 'off';

  return (
    <Screen
      title={isNote ? 'Note' : TYPE_TITLE[task.type]}
      onBack={goBack}
      right={<IconButton icon={MoreHorizontal} onPress={() => setMenuOpen(true)} accessibilityLabel="More actions" testID="s20-more" />}
    >
      <TaskHero
        taskId={taskId}
        name={task.name}
        icon={Icon}
        color={taskColor(task.color)}
        meta={metaParts({ schedule: cadenceSummary(task), extra: when, importance: task.importance, necessity: task.necessity })}
        showWeek={isTrackedTask && !task.isAsNeeded && endedOn === null && (task.type === 'routine' || task.type === 'course')}
        onIconPress={() => router.push(`/task/${taskId}/icon` as never)}
      />

      {isTodo ? (
        <>
          {isNote ? null : (
          <ListGroup>
            <ListRow
              label="Done"
              right={
                <Switch
                  value={!!task.todoDoneAt}
                  onValueChange={(v) => void patch({ todoDoneAt: v ? now() : null })}
                  accessibilityLabel="Mark as done"
                  testID="s20-todo-done"
                />
              }
            />
          </ListGroup>
          )}
          {task.note ? (
            <View style={styles.block}>
              <SectionHeading>{isNote ? 'Note' : 'Details'}</SectionHeading>
              <Card>
                <Text style={[styles.note, { color: t.color.text }]}>{task.note}</Text>
              </Card>
            </View>
          ) : null}
        </>
      ) : null}

      {endedOn !== null ? (
        <Card style={styles.todayCard} testID="s20-ended">
          <Text style={[styles.endedTitle, { color: t.color.text }]}>{END_COPY.endedTitle(format(parseLocalDate(endedOn), 'MMM d'))}</Text>
          <Text style={[styles.caption, { color: t.color.textMuted }]}>{END_COPY.endedBody}</Text>
          <Button label={END_COPY.startAgain} variant="secondary" onPress={() => void onStartAgain()} loading={startAgain.isPending} fullWidth testID="s20-start-again" />
        </Card>
      ) : null}

      {isTrackedTask && endedOn === null ? (
        <View style={styles.block}>
          <SectionHeading right={<Text style={[styles.headingAside, { color: t.color.textMuted }]}>{dayLongLabel(today)}</Text>}>Today</SectionHeading>
          <Card style={styles.todayCard}>
            <PlanTiles ideal={task.idealSteps.map((s) => s.text).join(', ') || null} fallback={task.fallbackSteps.map((s) => s.text).join(', ') || null} numberOfLines={3} />
            {!dueNow ? (
              <EmptyLine>Not due today.</EmptyLine>
            ) : isOffToday ? (
              <EmptyLine>Emergency day off. Turn it off below to log it.</EmptyLine>
            ) : isMultiDose ? (
              <>
                {Array.from({ length: task.dosesPerDay }, (_, i) => i).map((i) => (
                  <LogControl
                    key={i}
                    label={`Dose ${i + 1}`}
                    value={dosesDone >= i + 1 ? 'done' : 'todo'}
                    onChange={(chip) => void onDoseChange(i, chip)}
                    accessibilityLabel={`Dose ${i + 1} of ${task.dosesPerDay}`}
                    loggedLabel="Taken"
                    hideFallback
                    testID={`s20-dose-chip-${i}`}
                  />
                ))}
                <View style={[styles.rule, { backgroundColor: t.color.border }]} />
                <LogControl
                  label="Whole day"
                  caption={`${dosesDone} of ${task.dosesPerDay} doses taken. The day logs itself once every dose is handled, or you can set it here.`}
                  value={todayOccurrence?.chipState ?? null}
                  onChange={(chip) => void onChipChange(chip)}
                  accessibilityLabel="Whole day"
                  testID="s20-day-chip"
                />
              </>
            ) : (
              <>
                <LogControl value={todayOccurrence?.chipState ?? null} onChange={(chip) => void onChipChange(chip)} accessibilityLabel={task.name} testID="s20-chip" />
                {pushedToday ? (
                  <LogControl
                    label="From yesterday"
                    value={pushedToday.chipState ?? null}
                    onChange={(chip) => void onPushedChange(chip)}
                    accessibilityLabel={`${task.name}, from yesterday`}
                    testID="s20-pushed-chip"
                  />
                ) : null}
                {task.idealSteps.length > 1 ? (
                  <View>
                    <Text style={[styles.caption, { color: t.color.textMuted }]}>Ticking every step logs the day as ideal.</Text>
                    {task.idealSteps.map((step) => {
                      const dueToday = todayOccurrence?.dueIdealStepIds.includes(step.id) ?? false;
                      return (
                        <Checkbox
                          key={step.id}
                          checked={todayOccurrence?.completedStepIds.includes(step.id) ?? false}
                          onToggle={() => void onToggleStep(step.id)}
                          label={step.text}
                          disabled={!dueToday}
                          caption={dueToday ? undefined : 'Not due today'}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </>
            )}
          </Card>

          <ListGroup>
            <ListRow
              icon={LifeBuoy}
              label="Emergency day off"
              sublabel="Just this task, today. Doesn't count for or against you."
              right={<Switch value={isOffToday} onValueChange={onToggleOffDay} accessibilityLabel="Emergency day off, this task only" />}
            />
            {snoozeSlot.kind === 'undo' ? (
              <ListRow icon={Undo2} label="Undo push" sublabel="Move it back to yesterday" onPress={onSnoozeSlotPress} chevron={false} testID="s20-undo-snooze" />
            ) : (
              <ListRow
                icon={AlarmClock}
                label="Push to tomorrow"
                sublabel={snoozeSlot.enabled ? undefined : snoozeSlot.disabledReason}
                onPress={onSnoozeSlotPress}
                disabled={!snoozeSlot.enabled}
                chevron={false}
                testID="s20-snooze"
              />
            )}
            <ListRow
              label="Can be pushed to tomorrow"
              right={<Switch value={task.snoozable} onValueChange={(v) => void patch({ snoozable: v })} accessibilityLabel="Can be pushed to tomorrow" testID="s20-snoozable-switch" />}
            />
            {showScheduleEditor ? <ListRow icon={CalendarDays} label="Step schedule" sublabel="Which days each step applies" onPress={openSchedule} chevron={false} /> : null}
          </ListGroup>
        </View>
      ) : null}

      {task.type === 'routine' && !task.isAsNeeded && endedOn === null ? (
        <View style={styles.block}>
          <SectionHeading>Time</SectionHeading>
          <TimeField label="Time of day" value={task.timeOfDay ?? ''} onChange={(v) => void patch({ timeOfDay: v || null })} placeholder="Any time" />
        </View>
      ) : null}

      {endedOn !== null ? null : (
      <View style={styles.block}>
        <SectionHeading>Priority</SectionHeading>
        <Radio label="Importance" value={task.importance} options={IMPORTANCE_OPTIONS} onChange={(v) => void patch({ importance: v as Importance, priorityRank: null })} testID="s20-importance-picker" />
        {task.importance ? <PriorityPlaceRow taskId={taskId} importance={task.importance} /> : null}
        <Radio label="Necessity" value={task.necessity} options={NECESSITY_OPTIONS} onChange={(v) => void patch({ necessity: v as Necessity })} testID="s20-necessity-picker" />
      </View>
      )}

      {isTrackedTask ? (
        <View style={styles.block}>
          <SectionHeading>History</SectionHeading>
          {monthOccQuery.isError ? (
            <InlineRetryBanner message="Couldn't load your history. Try again." onRetry={() => monthOccQuery.refetch()} />
          ) : (
            <Card>
              <CalendarHeatmap
                days={heatmapDays}
                monthLabel={monthLabel}
                onPrevMonth={() => setMonthAnchor(addDays(startOfMonth(monthAnchor), -1))}
                onNextMonth={() => setMonthAnchor(addDays(endOfMonth(monthAnchor), 1))}
                onCellPress={(date) => {
                  // An ended habit's days after its last one are not part of it.
                  if (date < today && (endedOn === null || date <= endedOn)) setPopoverDate(date);
                }}
                statLine={statLine}
                emptyHistoryCaption={isEmptyHistory ? 'Your history will fill in as you log days.' : 'Tap a past day to change its log.'}
                accessibilityLabel={`Calendar, ${monthLabel}`}
              />
            </Card>
          )}
        </View>
      ) : null}

      <MenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={task.name}
        items={[
          {
            key: 'rename',
            icon: PencilLine,
            label: 'Rename',
            onPress: () => {
              setNameDraft(task.name);
              setRenameOpen(true);
            },
          },
          { key: 'icon', icon: Palette, label: 'Change icon and color', opensScreen: true, onPress: () => router.push(`/task/${taskId}/icon` as never) },
          ...(isTodo
            ? [
                {
                  key: 'kind',
                  icon: isNote ? ListTodo : StickyNote,
                  label: isNote ? 'Change to a to-do' : 'Change to a note',
                  onPress: () => void patch({ isNote: !isNote }),
                },
              ]
            : []),
          { key: 'duplicate', icon: Copy, label: 'Duplicate', onPress: () => void onDuplicate() },
          ...(canEnd
            ? [
                endedOn === null
                  ? { key: 'end', icon: CircleStop, label: `End ${noun}`, onPress: () => setEndOpen(true) }
                  : { key: 'start-again', icon: RotateCcw, label: END_COPY.startAgain, onPress: () => void onStartAgain() },
              ]
            : []),
          { key: 'delete', icon: Trash2, label: `Delete ${noun}`, danger: true, onPress: () => setDeleteOpen(true) },
        ]}
      />

      <Dialog visible={renameOpen} onClose={() => setRenameOpen(false)} title={`Rename ${noun}`} accessibilityLabel={`Rename ${noun}`}>
        <Input label="Name" value={nameDraft} onChangeText={setNameDraft} autoFocus accessibilityLabel="Task name" testID="s20-name-input" onSubmitEditing={() => void saveName()} />
        <ButtonPair
          primary={{ label: 'Save', onPress: () => void saveName(), loading: updateTask.isPending, testID: 's20-save-name' }}
          secondary={{ label: 'Cancel', onPress: () => setRenameOpen(false) }}
        />
      </Dialog>

      <Dialog visible={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Step schedule" accessibilityLabel="Step schedule">
        <Text style={[styles.caption, { color: t.color.textMuted }]}>Choose the days each ideal step applies. Locked days are days this {noun} doesn&apos;t run.</Text>
        {task.idealSteps.map((step) => (
          <WeekdayPicker
            key={step.id}
            label={step.text}
            selected={(scheduleDraft[step.id] ?? parentDays).filter((d) => parentDays.includes(d))}
            onChange={(sel) => setScheduleDraft((prev) => ({ ...prev, [step.id]: parentDays.every((d) => sel.includes(d)) ? null : sel }))}
            disabledDays={ALL_DAYS.filter((d) => !parentDays.includes(d))}
            accessibilityLabel={`${step.text} schedule`}
          />
        ))}
        {scheduleError ? (
          <Text accessibilityRole="alert" style={[styles.caption, { color: t.color.dangerDeep }]}>
            {scheduleError}
          </Text>
        ) : null}
        <ButtonPair
          primary={{ label: 'Save schedule', onPress: () => void saveSchedule(), loading: updateTask.isPending }}
          secondary={{ label: 'Cancel', onPress: () => setScheduleOpen(false) }}
        />
      </Dialog>

      <ConfirmSheet
        visible={endOpen}
        onClose={() => setEndOpen(false)}
        title={END_COPY.confirmTitle(noun)}
        message={END_COPY.confirmBody(noun)}
        confirmLabel={`End ${noun}`}
        onConfirm={() => void onEnd()}
        loading={endTask.isPending}
        testID="s20-end-confirm"
      />

      <DeleteTaskSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} task={task} openedFrom="manage" origin={from} onDeleted={() => setLeaving(true)} canEnd={canEnd && endedOn === null} />

      {popoverDate ? (
        <DayLogSheet
          taskId={taskId}
          date={popoverDate}
          occurrence={monthOccQuery.data?.find((o) => o.date === popoverDate)}
          onClose={() => setPopoverDate(null)}
          logState={logState}
          onFail={fail}
        />
      ) : null}
    </Screen>
  );
}

function DayLogSheet({
  taskId,
  date,
  occurrence,
  onClose,
  logState,
  onFail,
}: {
  readonly taskId: Id;
  readonly date: LocalDate;
  readonly occurrence: Occurrence | undefined;
  readonly onClose: () => void;
  readonly logState: ReturnType<typeof useLogState>;
  readonly onFail: () => void;
}) {
  const t = useTheme();
  async function onChange(chip: ChipState) {
    const result = await logState.mutateAsync({ taskId, date, chip });
    if (!result.ok) onFail();
    else onClose();
  }
  const label = dayLongLabel(date);
  return (
    <Dialog visible onClose={onClose} title={label} accessibilityLabel={`Log for ${label}`} testID="s20-day-popover">
      <Text style={[styles.caption, { color: t.color.textMuted }]}>Set how this day went.</Text>
      <LogButtons value={occurrence?.chipState ?? null} onChange={(chip) => void onChange(chip)} accessibilityLabel={label} testID="s20-day-popover-chip" />
    </Dialog>
  );
}

export const END_COPY = {
  confirmTitle: (noun: string) => `End this ${noun}?`,
  confirmBody: (noun: string) => `It moves to Ended and nothing is due from now on. Every day you've logged still counts. You can start this ${noun} again any time.`,
  endedTitle: (date: string) => `Ended ${date}`,
  endedBody: "Nothing is due from here on. The days before still count in your consistency.",
  startAgain: 'Start again',
  endedToast: 'Ended. Its past days still count.',
  startedToast: 'Started again from today.',
} as const;

const styles = StyleSheet.create({
  endedTitle: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  block: { gap: SPACE.s2 + 4 },
  todayCard: { gap: SPACE.s3 },
  headingAside: { fontSize: FONT_SIZE.sm },
  caption: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  note: { fontSize: FONT_SIZE.base, lineHeight: 24 },
  rule: { height: 1 },
});
