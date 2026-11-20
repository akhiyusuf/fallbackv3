/** S17 — New event. Date and time open the phone's own picker (D12). */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { SPACE } from '@/theme';
import { Button, CadencePicker, DateField, Input, ListGroup, ListRow, Radio, Screen, SectionHeading, Switch, TimeField } from '@/ui';
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

export default function S17CreateEvent() {
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.today);
  const createTask = useCreateTask();
  const showToast = useToastStore((s) => s.show);

  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState<LocalDate>(todayFn());
  const [timeOfDay, setTimeOfDay] = useState('');
  const [repeats, setRepeats] = useState(false);
  const [cadence, setCadence] = useState<Cadence>({ kind: 'specific-weekdays', weekdays: [] });
  const [tracking, setTracking] = useState(false);
  const [idealSteps, setIdealSteps] = useState<readonly StepDraft[]>([]);
  const [fallbackSteps, setFallbackSteps] = useState<readonly StepDraft[]>([]);

  const [nameError, setNameError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();
  const [cadenceError, setCadenceError] = useState<string | undefined>();
  const [bannerDay, setBannerDay] = useState<string | undefined>();
  const [errorWeekdays, setErrorWeekdays] = useState<readonly Weekday[]>([]);

  const parentDays = parentDaysFor(cadence);
  const showSubStepGrid = repeats && tracking && (cadence.kind === 'daily' || cadence.kind === 'specific-weekdays') && parentDays.length > 1 && idealSteps.length > 1;

  function buildDraft(): TaskDraft {
    return {
      type: 'event',
      name: name.trim(),
      eventDate: repeats ? null : eventDate,
      timeOfDay: timeOfDay || null,
      cadence: repeats ? cadence : null,
      idealSteps: tracking ? withoutBlankSteps(idealSteps) : [],
      fallbackSteps: tracking ? withoutBlankSteps(fallbackSteps) : [],
    };
  }

  function setTrackingOn(next: boolean) {
    setTracking(next);
    if (next && idealSteps.length === 0) setIdealSteps([{ text: '', dueWeekdays: null }]);
    if (next && fallbackSteps.length === 0) setFallbackSteps([{ text: '', dueWeekdays: null }]);
  }

  const onSave = useSingleFlightSave(save, () => showToast(SAVE_FAILED, 'warning'));
  async function save() {
    const draft = buildDraft();
    const validated = validateTaskDraft(draft);
    setNameError(draft.name.trim().length === 0 ? 'Give this event a name to save it.' : undefined);
    const dateInvalid = !repeats && !isValidLocalDateString(eventDate);
    setDateError(dateInvalid ? 'Pick a date for this event.' : undefined);
    setCadenceError(
      repeats && draft.cadence?.kind === 'specific-weekdays' && draft.cadence.weekdays.length === 0 ? 'Pick at least one day this event repeats on.' : undefined,
    );
    const offending = repeats && tracking && idealSteps.length > 0 ? emptyRunOccurrences(draft) : [];
    setBannerDay(offending[0]);
    setErrorWeekdays(offending.map((n) => WEEKDAY_NAME_TO_NUM[n]).filter((n): n is Weekday => n !== undefined));
    if (!validated.ok || dateInvalid) return;

    const result = await createTask.mutateAsync(draft);
    if (result.ok) {
      router.dismissTo(ROUTES.today);
      showToast('Event saved', 'success');
    } else {
      showToast(SAVE_FAILED, 'warning');
    }
  }

  return (
    <Screen
      title="New event"
      onBack={goBack}
      footer={<Button label="Save event" onPress={onSave} loading={createTask.isPending} accessibilityLabel="Save event" fullWidth />}
    >
      <SayItInsteadRow what="event" />
      <Input label="Name" value={name} onChangeText={setName} placeholder="Dentist visit" error={nameError} accessibilityLabel="Event name" />

      <SectionHeading>When</SectionHeading>
      <Radio
        label="Repeats"
        value={repeats ? 'repeats' : 'does-not-repeat'}
        options={[
          { value: 'does-not-repeat', label: 'One-time' },
          { value: 'repeats', label: 'Repeats' },
        ]}
        onChange={(v) => setRepeats(v === 'repeats')}
      />
      {repeats ? (
        <CadencePicker value={cadence} onChange={setCadence} weekdayError={cadenceError} testID="event-cadence-picker" />
      ) : null}
      <View style={styles.row}>
        {repeats ? null : <DateField label="Date" value={eventDate} onChange={(v) => setEventDate(v as LocalDate)} error={dateError} />}
        <TimeField label="Time" value={timeOfDay} onChange={setTimeOfDay} placeholder="Any time" />
      </View>

      <ListGroup footer="Optional for events. Turn it on if you want to log this as ideal or fallback.">
        <ListRow
          label="Track ideal and fallback"
          right={<Switch value={tracking} onValueChange={setTrackingOn} accessibilityLabel="Track ideal and fallback" testID="event-tracking-switch" />}
        />
      </ListGroup>

      {tracking ? (
        <>
          <StepListEditor label="Ideal" itemLabel="Ideal step" helper="Your full version, on a good day." steps={idealSteps}
            onChange={setIdealSteps}
            schedule={
              showSubStepGrid
                ? {
                    parentDays,
                    onToggle: (i, day) => setIdealSteps((prev) => toggleStepDay(prev, parentDays, i, day)),
                    helper: 'Under each step: the days it runs. Each time the event is due, unless you turn some off.',
                    bannerDay,
                  }
                : undefined
            }
            testID="event-ideal-editor"
          />
          <StepListEditor
            label="Fallback"
            itemLabel="Fallback step"
            helper="The smallest version that still counts as showing up."
            steps={fallbackSteps}
            onChange={setFallbackSteps}
            testID="event-fallback-editor"
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: SPACE.s2 + 4 } });
