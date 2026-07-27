/**
 * S17 — Create Event    route: /add/event
 * Owner: M4. Features: F11, F24, F26.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S17)
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Button, IconButton, Input, Radio, Switch } from '@/ui';
import { CadencePicker, SubStepScheduleGrid } from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { emptyRunOccurrences, validateTaskDraft } from '@/domain';
import { useCreateTask } from '@/queries';
import { today as todayFn } from '@/lib/date';
import type { Cadence, LocalDate, StepDraft, TaskDraft, Weekday } from '@/types';
import { StepListEditor } from '@/features/task/StepListEditor';
import { isValidLocalDateString } from '@/features/task/dateValidation';
import { useToastStore } from '@/app-shell/stores/toast';

const WEEKDAY_NAME_TO_NUM: Record<string, Weekday> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

function parentDaysFor(cadence: Cadence): readonly Weekday[] {
  if (cadence.kind === 'daily') return [1, 2, 3, 4, 5, 6, 7];
  if (cadence.kind === 'specific-weekdays') return cadence.weekdays;
  return [];
}

export default function S17CreateEvent() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.addPickType);
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
  const showSubStepGrid = repeats && tracking && (cadence.kind === 'daily' || cadence.kind === 'specific-weekdays') && idealSteps.length > 0;

  function buildDraft(): TaskDraft {
    return {
      type: 'event',
      name,
      eventDate: repeats ? null : eventDate,
      timeOfDay: timeOfDay || null,
      cadence: repeats ? cadence : null,
      idealSteps: tracking ? idealSteps : [],
      fallbackSteps: tracking ? fallbackSteps : [],
    };
  }

  function toggleGridCell(stepId: string, day: Weekday) {
    const index = Number(stepId);
    setIdealSteps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const current = s.dueWeekdays ?? parentDays;
        const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
        return { ...s, dueWeekdays: parentDays.every((d) => next.includes(d)) ? null : next };
      }),
    );
  }

  async function onSave() {
    const draft = buildDraft();
    const validated = validateTaskDraft(draft);

    setNameError(draft.name.trim().length === 0 ? 'Give this event a name to save it.' : undefined);
    // Item 7 fix: `validateTaskDraft` (M2, frozen) only checks presence, never shape — an
    // unparseable free-typed date must still surface a visible error, not fail silently.
    const dateInvalid = !repeats && !isValidLocalDateString(eventDate);
    setDateError(dateInvalid ? "That date doesn't look right — use YYYY-MM-DD." : undefined);
    setCadenceError(
      repeats && draft.cadence?.kind === 'specific-weekdays' && draft.cadence.weekdays.length === 0
        ? 'Pick at least one day this event repeats on.'
        : undefined,
    );
    const offending = repeats && tracking && idealSteps.length > 0 ? emptyRunOccurrences(draft) : [];
    setBannerDay(offending[0]);
    setErrorWeekdays(offending.map((n) => WEEKDAY_NAME_TO_NUM[n]).filter((n): n is Weekday => n !== undefined));

    if (!validated.ok || dateInvalid) return;
    const result = await createTask.mutateAsync(draft);
    if (result.ok) {
      router.replace(ROUTES.today);
    } else {
      showToast("Couldn't save that — try again.", 'warning');
    }
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={goBack} accessibilityLabel="Back" />
        <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
          New Event
        </Text>
      </View>

      <Input label="Event name" value={name} onChangeText={setName} placeholder="e.g. Dentist visit" error={nameError} accessibilityLabel="Event name" />
      <Input label="Date" value={eventDate} onChangeText={(v) => setEventDate(v as LocalDate)} error={dateError} accessibilityLabel="Date" />
      <Input label="Time" value={timeOfDay} onChangeText={setTimeOfDay} placeholder="Optional" accessibilityLabel="Time" />

      <Radio
        label="Recurrence"
        value={repeats ? 'repeats' : 'does-not-repeat'}
        options={[
          { value: 'does-not-repeat', label: 'Does not repeat' },
          { value: 'repeats', label: 'Repeats' },
        ]}
        onChange={(v) => setRepeats(v === 'repeats')}
      />

      {repeats ? (
        <>
          <Text style={[styles.helper, { color: t.color.textMuted }]}>Still an Event — just one that repeats.</Text>
          <CadencePicker value={cadence} onChange={setCadence} weekdayError={cadenceError} testID="event-cadence-picker" />
        </>
      ) : null}

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: t.color.text }]}>Track with ideal + fallback</Text>
        <Switch value={tracking} onValueChange={setTracking} accessibilityLabel="Track with ideal + fallback" testID="event-tracking-switch" />
      </View>
      <Text style={[styles.helper, { color: t.color.textMuted }]}>
        Optional for events — turn this on if you want the ideal/fallback logging model.
      </Text>

      {tracking ? (
        <>
          {showSubStepGrid ? (
            <View style={styles.subStepRegion}>
              <Text style={[styles.label, { color: t.color.text }]}>When does each step apply?</Text>
              <Text style={[styles.helper, { color: t.color.textMuted }]}>
                Every step runs on every occurrence this event is due, unless you narrow it below.
              </Text>
              {bannerDay ? (
                <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: t.color.surface, borderColor: t.color.danger }]}>
                  <Text style={{ color: t.color.danger }}>{bannerDay} has no ideal step due — every step is toggled off for that day.</Text>
                </View>
              ) : null}
              <SubStepScheduleGrid
                steps={idealSteps.map((s, i) => ({ id: String(i), text: s.text || `Step ${i + 1}`, dueWeekdays: s.dueWeekdays }))}
                parentDays={parentDays}
                onToggle={toggleGridCell}
                errorDays={errorWeekdays}
                accessibilityLabel="When does each step apply?"
              />
            </View>
          ) : repeats && cadence.kind !== 'daily' && cadence.kind !== 'specific-weekdays' ? (
            <Text style={[styles.helper, { color: t.color.textMuted }]}>Single occurrence per period — nothing to subset.</Text>
          ) : null}

          <StepListEditor label="Ideal — your full version" itemLabel="Ideal step" steps={idealSteps} onChange={setIdealSteps} testID="event-ideal-editor" />
          <StepListEditor
            label="Fallback — your minimum-viable version"
            itemLabel="Fallback step"
            steps={fallbackSteps}
            onChange={setFallbackSteps}
            testID="event-fallback-editor"
          />
        </>
      ) : null}

      <View style={styles.footer}>
        <Button label="Save event" onPress={onSave} loading={createTask.isPending} accessibilityLabel="Save event" fullWidth />
        <Button label="Cancel" onPress={goBack} variant="ghost" accessibilityLabel="Cancel" fullWidth />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  title: { fontSize: 24, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16, fontWeight: '600' },
  helper: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600' },
  subStepRegion: { gap: SPACE.s2 },
  banner: { borderWidth: 1, borderRadius: 8, padding: SPACE.s2 },
  footer: { gap: SPACE.s2, marginTop: SPACE.s3 },
});
