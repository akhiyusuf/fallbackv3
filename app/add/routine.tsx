/**
 * S16 — Create Routine    route: /add/routine
 * Owner: M4. Features: F2, F23, F26, F27.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S16)
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { SPACE, useTheme } from '@/theme';
import { Button, Card, IconButton, Input, Radio, Switch } from '@/ui';
import { CadencePicker, SubStepScheduleGrid } from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { emptyRunOccurrences, validateTaskDraft } from '@/domain';
import { useCreateTask } from '@/queries';
import type { Cadence, Importance, Necessity, StepDraft, TaskDraft, Weekday } from '@/types';
import { StepListEditor } from '@/features/task/StepListEditor';
import { useToastStore } from '@/app-shell/stores/toast';
import { ChevronLeft } from 'lucide-react-native';

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

export default function S16CreateRoutine() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.addPickType);
  const createTask = useCreateTask();
  const showToast = useToastStore((s) => s.show);

  const [name, setName] = useState('');
  const [isAsNeeded, setIsAsNeeded] = useState(false);
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

  const showSubStepGrid = !isAsNeeded && (cadence.kind === 'daily' || cadence.kind === 'specific-weekdays') && idealSteps.length > 0;
  const parentDays = parentDaysFor(cadence);

  function buildDraft(): TaskDraft {
    return {
      type: 'routine',
      name,
      isAsNeeded,
      cadence: isAsNeeded ? null : cadence,
      importance,
      necessity,
      idealSteps: isAsNeeded ? idealSteps.filter((s) => s.text.trim().length > 0) : idealSteps,
      fallbackSteps: isAsNeeded ? fallbackSteps.filter((s) => s.text.trim().length > 0) : fallbackSteps,
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
    const requiresIdeal = !isAsNeeded;

    setNameError(draft.name.trim().length === 0 ? 'Give this routine a name to save it.' : undefined);
    setCadenceError(
      requiresIdeal && draft.cadence?.kind === 'specific-weekdays' && draft.cadence.weekdays.length === 0
        ? 'Pick at least one day this routine runs.'
        : undefined,
    );

    const idealEmpty = requiresIdeal && draft.idealSteps.length === 0;
    setIdealError(idealEmpty ? 'Add at least one ideal step to save this routine.' : undefined);
    setFallbackError(requiresIdeal && draft.fallbackSteps.length === 0 ? 'Add a fallback — your minimum-viable version for a hard day.' : undefined);

    const offending = requiresIdeal && !idealEmpty ? emptyRunOccurrences(draft) : [];
    setBannerDay(offending[0]);
    setErrorWeekdays(offending.map((n) => WEEKDAY_NAME_TO_NUM[n]).filter((n): n is Weekday => n !== undefined));

    if (!validated.ok) return;

    const result = await createTask.mutateAsync(draft);
    if (result.ok) {
      router.replace(ROUTES.today);
    } else {
      // Item 7 fix: a failed save must never be silent — form data is untouched (no state
      // reset below), so the user can retry with the same input.
      showToast("Couldn't save that — try again.", 'warning');
    }
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={goBack} accessibilityLabel="Back" />
        <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
          New Routine
        </Text>
      </View>

      <Input label="Routine name" value={name} onChangeText={setName} placeholder="e.g. Studying" error={nameError} accessibilityLabel="Routine name" />

      <Card accessibilityLabel="As-needed routine settings">
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: t.color.text }]}>As-needed routine</Text>
          <Switch value={isAsNeeded} onValueChange={setIsAsNeeded} accessibilityLabel="As-needed routine" testID="as-needed-switch" />
        </View>
        <Text style={[styles.helper, { color: t.color.textMuted }]}>
          No schedule, no consistency tracking. Use this for something you&apos;ll trigger occasionally — an emergency plan, a rare situation — not a
          daily habit.
        </Text>
      </Card>

      {isAsNeeded ? (
        <Text style={[styles.helper, { color: t.color.textMuted }]}>
          As-needed routines skip Today entirely — you&apos;ll log them from the Routines list whenever the situation comes up.
        </Text>
      ) : (
        <>
          <CadencePicker value={cadence} onChange={setCadence} weekdayError={cadenceError} testID="routine-cadence-picker" />

          {showSubStepGrid ? (
            <View style={styles.subStepRegion}>
              <Text style={[styles.label, { color: t.color.text }]}>When does each step apply?</Text>
              <Text style={[styles.helper, { color: t.color.textMuted }]}>
                Every step runs on every day this routine is due, unless you narrow it below.
              </Text>
              {bannerDay ? (
                <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: t.color.surface, borderColor: t.color.danger }]}>
                  <Text style={{ color: t.color.danger }}>
                    {bannerDay} has no ideal step due — every step is toggled off. Turn at least one back on for {bannerDay}, or add a step that runs
                    then.
                  </Text>
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
          ) : cadence.kind !== 'daily' && cadence.kind !== 'specific-weekdays' ? (
            <Text style={[styles.helper, { color: t.color.textMuted }]}>
              Single occurrence per period — nothing to subset. Every ideal step simply runs whenever this routine is due.
            </Text>
          ) : null}
        </>
      )}

      <StepListEditor
        label={isAsNeeded ? 'Ideal (optional)' : 'Ideal — your full version'}
        itemLabel="Ideal step"
        steps={idealSteps}
        onChange={setIdealSteps}
        error={idealError}
        testID="ideal-steps-editor"
      />

      <StepListEditor
        label={isAsNeeded ? 'Fallback (optional)' : 'Fallback — your minimum-viable version'}
        itemLabel="Fallback step"
        helper="This is a whole-routine fallback — it's available every day the routine runs, not scheduled per step."
        steps={fallbackSteps}
        onChange={setFallbackSteps}
        error={fallbackError}
        testID="fallback-steps-editor"
      />

      <Radio label="Importance" value={importance} options={IMPORTANCE_OPTIONS} onChange={(v) => setImportance(v as Importance)} />
      <Radio label="Necessity" value={necessity} options={NECESSITY_OPTIONS} onChange={(v) => setNecessity(v as Necessity)} />

      <View style={styles.footer}>
        <Button label="Save routine" onPress={onSave} loading={createTask.isPending} accessibilityLabel="Save routine" fullWidth />
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
