/** S16 — New routine. Page header (D4), bold section headings (D19), pinned Save (D8). */
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { FONT_SIZE, useTheme } from '@/theme';
import { Button, CadencePicker, Input, ListGroup, ListRow, Radio, Screen, SectionHeading, Switch, TimeField } from '@/ui';
import { SayItInsteadRow } from '@/features/assistant/SayItInsteadRow';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { emptyRunOccurrences, validateTaskDraft } from '@/domain';
import { useCreateTask } from '@/queries';
import type { Cadence, Importance, Necessity, StepDraft, TaskDraft, Weekday } from '@/types';
import { StepListEditor } from '@/features/task/StepListEditor';
import { WEEKDAY_NAME_TO_NUM, toggleStepDay } from '@/features/task/StepScheduleSection';
import { IMPORTANCE_OPTIONS, NECESSITY_OPTIONS, SAVE_FAILED, parentDaysFor } from '@/features/task/formShared';
import { useToastStore } from '@/app-shell/stores/toast';
import { Text } from '@/ui/AppText';

export default function S16CreateRoutine() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.today);
  const createTask = useCreateTask();
  const showToast = useToastStore((s) => s.show);

  const [name, setName] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [isAsNeeded, setIsAsNeeded] = useState(false);
  const [snoozable, setSnoozable] = useState(true);
  const [cadence, setCadence] = useState<Cadence>({ kind: 'specific-weekdays', weekdays: [] });
  const [idealSteps, setIdealSteps] = useState<readonly StepDraft[]>([{ text: '', dueWeekdays: null }]);
  const [fallbackSteps, setFallbackSteps] = useState<readonly StepDraft[]>([{ text: '', dueWeekdays: null }]);
  const [importance, setImportance] = useState<Importance | null>(null);
  const [necessity, setNecessity] = useState<Necessity | null>(null);

  const [nameError, setNameError] = useState<string | undefined>();
  const [cadenceError, setCadenceError] = useState<string | undefined>();
  const [idealError, setIdealError] = useState<string | undefined>();
  const [fallbackError, setFallbackError] = useState<string | undefined>();
  const [bannerDay, setBannerDay] = useState<string | undefined>();
  const [errorWeekdays, setErrorWeekdays] = useState<readonly Weekday[]>([]);

  const parentDays = parentDaysFor(cadence);
  const showSubStepGrid = !isAsNeeded && (cadence.kind === 'daily' || cadence.kind === 'specific-weekdays') && parentDays.length > 1 && idealSteps.length > 1;

  function buildDraft(): TaskDraft {
    return {
      type: 'routine',
      name,
      isAsNeeded,
      cadence: isAsNeeded ? null : cadence,
      timeOfDay: isAsNeeded ? null : timeOfDay || null,
      importance,
      necessity,
      snoozable: isAsNeeded ? false : snoozable,
      idealSteps: isAsNeeded ? idealSteps.filter((s) => s.text.trim().length > 0) : idealSteps,
      fallbackSteps: isAsNeeded ? fallbackSteps.filter((s) => s.text.trim().length > 0) : fallbackSteps,
    };
  }

  async function onSave() {
    const draft = buildDraft();
    const validated = validateTaskDraft(draft);
    const requiresIdeal = !isAsNeeded;
    setNameError(draft.name.trim().length === 0 ? 'Give this routine a name to save it.' : undefined);
    setCadenceError(
      requiresIdeal && draft.cadence?.kind === 'specific-weekdays' && draft.cadence.weekdays.length === 0 ? 'Pick at least one day this routine runs.' : undefined,
    );
    const idealEmpty = requiresIdeal && draft.idealSteps.length === 0;
    setIdealError(idealEmpty ? 'Add at least one ideal step to save this routine.' : undefined);
    setFallbackError(requiresIdeal && draft.fallbackSteps.length === 0 ? 'Add a fallback: the smallest version for a hard day.' : undefined);
    const offending = requiresIdeal && !idealEmpty ? emptyRunOccurrences(draft) : [];
    setBannerDay(offending[0]);
    setErrorWeekdays(offending.map((n) => WEEKDAY_NAME_TO_NUM[n]).filter((n): n is Weekday => n !== undefined));
    if (!validated.ok) return;

    const result = await createTask.mutateAsync(draft);
    if (result.ok) {
      router.replace(ROUTES.today);
      showToast('Routine saved', 'success');
    } else {
      showToast(SAVE_FAILED, 'warning');
    }
  }

  return (
    <Screen
      title="New routine"
      onBack={goBack}
      footer={<Button label="Save routine" onPress={onSave} loading={createTask.isPending} accessibilityLabel="Save routine" fullWidth />}
    >
      <SayItInsteadRow what="routine" />
      <Input label="Name" value={name} onChangeText={setName} placeholder="Studying" error={nameError} accessibilityLabel="Routine name" />

      <ListGroup footer="As-needed routines have no schedule and no consistency tracking. You log them from the Routines list when the situation comes up.">
        <ListRow
          label="As-needed"
          sublabel="For something occasional, not a daily habit"
          right={<Switch value={isAsNeeded} onValueChange={setIsAsNeeded} accessibilityLabel="As-needed routine" testID="as-needed-switch" />}
        />
      </ListGroup>

      {isAsNeeded ? null : (
        <>
          <SectionHeading>Schedule</SectionHeading>
          <CadencePicker value={cadence} onChange={setCadence} weekdayError={cadenceError} testID="routine-cadence-picker" />
          <TimeField label="Time (optional)" value={timeOfDay} onChange={setTimeOfDay} placeholder="Any time" />
          <ListGroup footer="When it's on, a day you can't manage can be moved to tomorrow from the routine's own screen, instead of being missed. Turn it off for something that can't wait.">
            <ListRow
              label="Can be moved to tomorrow"
              sublabel="Snooze a day instead of missing it"
              right={<Switch value={snoozable} onValueChange={setSnoozable} accessibilityLabel="Can be moved to tomorrow" testID="routine-snoozable-switch" />}
            />
          </ListGroup>
        </>
      )}

      <StepListEditor
        label={isAsNeeded ? 'Ideal (optional)' : 'Ideal'}
        itemLabel="Ideal step"
        helper="Your full version, on a good day."
        steps={idealSteps}
        onChange={setIdealSteps}
        error={idealError}
        schedule={
          showSubStepGrid
            ? {
                parentDays,
                onToggle: (i, day) => setIdealSteps((prev) => toggleStepDay(prev, parentDays, i, day)),
                helper: 'Under each step: the days it runs. Every day the routine is due, unless you turn some off.',
                bannerDay,
              }
            : undefined
        }
        testID="ideal-steps-editor"
      />

      {!showSubStepGrid && bannerDay ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: t.color.danger }]}>{`${bannerDay} has no ideal step due.`}</Text>
      ) : null}

      <StepListEditor
        label={isAsNeeded ? 'Fallback (optional)' : 'Fallback'}
        itemLabel="Fallback step"
        helper="The smallest version that still counts as showing up. Available every day the routine runs."
        steps={fallbackSteps}
        onChange={setFallbackSteps}
        error={fallbackError}
        testID="fallback-steps-editor"
      />

      <SectionHeading>Priority</SectionHeading>
      <Radio label="Importance" value={importance} options={IMPORTANCE_OPTIONS} onChange={(v) => setImportance(v as Importance)} />
      <Radio label="Necessity" value={necessity} options={NECESSITY_OPTIONS} onChange={(v) => setNecessity(v as Necessity)} />
    </Screen>
  );
}

const styles = StyleSheet.create({ error: { fontSize: FONT_SIZE.sm } });
