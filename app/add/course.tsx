/** S18 — New course. Date pickers (D12), a stepper for doses per day, pinned Save (D8). */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { SPACE } from '@/theme';
import { Button, CadencePicker, DateField, Input, Screen, SectionHeading, Stepper } from '@/ui';
import { SayItInsteadRow } from '@/features/assistant/SayItInsteadRow';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { emptyRunOccurrences, validateTaskDraft } from '@/domain';
import { useCreateTask } from '@/queries';
import { today as todayFn } from '@/lib/date';
import type { Cadence, LocalDate, StepDraft, TaskDraft, Weekday } from '@/types';
import { StepListEditor } from '@/features/task/StepListEditor';
import { WEEKDAY_NAME_TO_NUM, toggleStepDay } from '@/features/task/StepScheduleSection';
import { SAVE_FAILED, parentDaysFor, useSingleFlightSave, withoutBlankSteps } from '@/features/task/formShared';
import { isValidLocalDateString } from '@/features/task/dateValidation';
import { useToastStore } from '@/app-shell/stores/toast';

export default function S18CreateCourse() {
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.today);
  const createTask = useCreateTask();
  const showToast = useToastStore((s) => s.show);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<LocalDate>(todayFn());
  const [endDate, setEndDate] = useState<LocalDate | ''>('');
  const [doses, setDoses] = useState(1);
  const [cadence, setCadence] = useState<Cadence>({ kind: 'daily' });
  const [idealSteps, setIdealSteps] = useState<readonly StepDraft[]>([{ text: '', dueWeekdays: null }]);
  const [fallbackSteps, setFallbackSteps] = useState<readonly StepDraft[]>([{ text: '', dueWeekdays: null }]);

  const [nameError, setNameError] = useState<string | undefined>();
  const [startDateError, setStartDateError] = useState<string | undefined>();
  const [endDateError, setEndDateError] = useState<string | undefined>();
  const [cadenceError, setCadenceError] = useState<string | undefined>();
  const [idealError, setIdealError] = useState<string | undefined>();
  const [fallbackError, setFallbackError] = useState<string | undefined>();
  const [bannerDay, setBannerDay] = useState<string | undefined>();
  const [errorWeekdays, setErrorWeekdays] = useState<readonly Weekday[]>([]);

  const parentDays = parentDaysFor(cadence);
  const showSubStepGrid = (cadence.kind === 'daily' || cadence.kind === 'specific-weekdays') && parentDays.length > 1 && idealSteps.length > 1;

  function buildDraft(): TaskDraft {
    return { type: 'course', name: name.trim(), startDate, endDate: endDate || null, dosesPerDay: doses, cadence, idealSteps: withoutBlankSteps(idealSteps), fallbackSteps: withoutBlankSteps(fallbackSteps) };
  }

  const onSave = useSingleFlightSave(save, () => showToast(SAVE_FAILED, 'warning'));
  async function save() {
    const draft = buildDraft();
    const validated = validateTaskDraft(draft);
    setNameError(draft.name.trim().length === 0 ? 'Give this course a name to save it.' : undefined);
    const startDateInvalid = !isValidLocalDateString(startDate);
    setStartDateError(startDateInvalid ? 'Pick a start date.' : undefined);
    const endDateInvalid = endDate !== '' && !isValidLocalDateString(endDate);
    // Dates are stored as YYYY-MM-DD, so comparing the text compares the days.
    const endBeforeStart = !startDateInvalid && !endDateInvalid && endDate !== '' && endDate < startDate;
    setEndDateError(!draft.endDate ? 'Set an end date. A course runs for a fixed span.' : endDateInvalid ? 'Pick an end date.' : endBeforeStart ? 'The end date is before the start date.' : undefined);
    setCadenceError(draft.cadence?.kind === 'specific-weekdays' && draft.cadence.weekdays.length === 0 ? 'Pick at least one day this course runs.' : undefined);
    const idealEmpty = draft.idealSteps.length === 0;
    setIdealError(idealEmpty ? 'Add at least one ideal step to save this course.' : undefined);
    setFallbackError(draft.fallbackSteps.length === 0 ? 'Add a fallback: the smallest version for a hard day.' : undefined);
    const offending = !idealEmpty ? emptyRunOccurrences(draft) : [];
    setBannerDay(offending[0]);
    setErrorWeekdays(offending.map((n) => WEEKDAY_NAME_TO_NUM[n]).filter((n): n is Weekday => n !== undefined));
    if (!validated.ok || startDateInvalid || endDateInvalid || endBeforeStart) return;

    const result = await createTask.mutateAsync(draft);
    if (result.ok) {
      router.dismissTo(ROUTES.today);
      showToast('Course saved', 'success');
    } else {
      showToast(SAVE_FAILED, 'warning');
    }
  }

  return (
    <Screen
      title="New course"
      onBack={goBack}
      footer={<Button label="Save course" onPress={onSave} loading={createTask.isPending} accessibilityLabel="Save course" fullWidth />}
    >
      <SayItInsteadRow what="course" />
      <Input label="Name" value={name} onChangeText={setName} placeholder="Antibiotics" error={nameError} accessibilityLabel="Course name" />

      <SectionHeading>Schedule</SectionHeading>
      <View style={styles.row}>
        <DateField label="Starts" value={startDate} onChange={(v) => setStartDate(v as LocalDate)} error={startDateError} />
        <DateField label="Ends" value={endDate} onChange={(v) => setEndDate(v as LocalDate)} error={endDateError} min={startDate} />
      </View>
      <CadencePicker value={cadence} onChange={setCadence} weekdayError={cadenceError} testID="course-cadence-picker" />
      <Stepper
        label="Doses per day"
        value={doses}
        onChange={setDoses}
        min={1}
        max={12}
        helper={doses > 1 ? 'Each dose is logged on its own. The day counts once every dose is handled.' : undefined}
      />

      <StepListEditor label="Ideal" itemLabel="Ideal step" helper="Your full version, on a good day." steps={idealSteps}
        onChange={setIdealSteps}
        error={idealError}
        schedule={
          showSubStepGrid
            ? {
                parentDays,
                onToggle: (i, day) => setIdealSteps((prev) => toggleStepDay(prev, parentDays, i, day)),
                helper: 'Under each step: the days it runs. These apply to the whole day, not a single dose.',
                footnote: 'A day logs as ideal once every dose is handled and every step due that day is complete.',
                bannerDay,
              }
            : undefined
        }
        testID="course-ideal-editor"
      />


      <StepListEditor
        label="Fallback"
        itemLabel="Fallback step"
        helper="The smallest version that still counts as showing up."
        steps={fallbackSteps}
        onChange={setFallbackSteps}
        error={fallbackError}
        testID="course-fallback-editor"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: SPACE.s2 + 4 } });
