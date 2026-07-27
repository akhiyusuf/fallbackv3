/**
 * S18 — Create Course    route: /add/course
 * Owner: M4. Features: F11, F12, F24, F26.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S18)
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Button, CadencePicker, IconButton, Input, SubStepScheduleGrid } from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { emptyRunOccurrences, validateTaskDraft } from '@/domain';
import { useCreateTask } from '@/queries';
import { addDays, today as todayFn } from '@/lib/date';
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

export default function S18CreateCourse() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.addPickType);
  const createTask = useCreateTask();
  const showToast = useToastStore((s) => s.show);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<LocalDate>(todayFn());
  const [endDate, setEndDate] = useState<LocalDate | ''>('');
  const [dosesPerDay, setDosesPerDay] = useState('1');
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
  const showSubStepGrid = (cadence.kind === 'daily' || cadence.kind === 'specific-weekdays') && idealSteps.length > 0;
  const doses = Number(dosesPerDay) || 1;

  function buildDraft(): TaskDraft {
    return {
      type: 'course',
      name,
      startDate,
      endDate: endDate || null,
      dosesPerDay: doses,
      cadence,
      idealSteps,
      fallbackSteps,
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

    setNameError(draft.name.trim().length === 0 ? 'Give this course a name to save it.' : undefined);
    // Item 7 fix: `validateTaskDraft` (M2, frozen) only checks presence, never shape — an
    // unparseable free-typed date must still surface a visible error, not fail silently.
    const startDateInvalid = !isValidLocalDateString(startDate);
    setStartDateError(startDateInvalid ? "That date doesn't look right — use YYYY-MM-DD." : undefined);
    const endDateInvalid = endDate !== '' && !isValidLocalDateString(endDate);
    setEndDateError(
      !draft.endDate
        ? 'Set an end date — a course always runs for a fixed span.'
        : endDateInvalid
          ? "That date doesn't look right — use YYYY-MM-DD."
          : undefined,
    );
    setCadenceError(
      draft.cadence?.kind === 'specific-weekdays' && draft.cadence.weekdays.length === 0 ? 'Pick at least one day this course runs.' : undefined,
    );
    const idealEmpty = idealSteps.length === 0;
    setIdealError(idealEmpty ? 'Add at least one ideal step to save this course.' : undefined);
    setFallbackError(fallbackSteps.length === 0 ? 'Add a fallback — your minimum-viable version for a hard day.' : undefined);

    const offending = !idealEmpty ? emptyRunOccurrences(draft) : [];
    setBannerDay(offending[0]);
    setErrorWeekdays(offending.map((n) => WEEKDAY_NAME_TO_NUM[n]).filter((n): n is Weekday => n !== undefined));

    if (!validated.ok || startDateInvalid || endDateInvalid) return;
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
          New Course
        </Text>
      </View>

      <Input label="Course name" value={name} onChangeText={setName} placeholder="e.g. Antibiotics" error={nameError} accessibilityLabel="Course name" />
      <Input label="Start date" value={startDate} onChangeText={(v) => setStartDate(v as LocalDate)} error={startDateError} accessibilityLabel="Start date" />
      <Input
        label="End date"
        value={endDate}
        onChangeText={(v) => setEndDate(v as LocalDate)}
        error={endDateError}
        accessibilityLabel="End date"
        placeholder={addDays(startDate, 10)}
      />
      <Input label="Doses per day" value={dosesPerDay} onChangeText={setDosesPerDay} keyboardType="number-pad" accessibilityLabel="Doses per day" />
      {doses > 1 ? (
        <Text style={[styles.helper, { color: t.color.textMuted }]}>Each dose completes on its own — the day counts once every dose is handled.</Text>
      ) : null}

      <CadencePicker value={cadence} onChange={setCadence} weekdayError={cadenceError} testID="course-cadence-picker" />

      {showSubStepGrid ? (
        <View style={styles.subStepRegion}>
          <Text style={[styles.label, { color: t.color.text }]}>When does each step apply?</Text>
          <Text style={[styles.helper, { color: t.color.textMuted }]}>These toggles apply to the whole day, not a single dose.</Text>
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
          <Text style={[styles.helper, { color: t.color.textMuted }]}>
            A day logs ideal once every dose is handled and every step due that day is complete.
          </Text>
        </View>
      ) : cadence.kind !== 'daily' && cadence.kind !== 'specific-weekdays' ? (
        <Text style={[styles.helper, { color: t.color.textMuted }]}>Single occurrence per period — nothing to subset.</Text>
      ) : null}

      <StepListEditor
        label="Ideal — your full version"
        itemLabel="Ideal step"
        steps={idealSteps}
        onChange={setIdealSteps}
        error={idealError}
        testID="course-ideal-editor"
      />
      <StepListEditor
        label="Fallback — your minimum-viable version"
        itemLabel="Fallback step"
        steps={fallbackSteps}
        onChange={setFallbackSteps}
        error={fallbackError}
        testID="course-fallback-editor"
      />

      <View style={styles.footer}>
        <Button label="Save course" onPress={onSave} loading={createTask.isPending} accessibilityLabel="Save course" fullWidth />
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
  helper: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600' },
  subStepRegion: { gap: SPACE.s2 },
  banner: { borderWidth: 1, borderRadius: 8, padding: SPACE.s2 },
  footer: { gap: SPACE.s2, marginTop: SPACE.s3 },
});
