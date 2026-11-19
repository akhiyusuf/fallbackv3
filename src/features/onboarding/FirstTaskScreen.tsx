/** S08 — onboarding step 7: add the first routine. Same top bar as every other step (D6). */
import { useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { now } from '@/lib/date';
import { useCreateTask, useUpdateSettings } from '@/queries';
import { useToastStore } from '@/app-shell';
import { FONT_SIZE, useTheme } from '@/theme';
import { Input } from '@/ui';
import type { TaskDraft } from '@/types';

import { S08_COPY } from './copy';
import { OnboardingShell, useOnboardingDensity } from './OnboardingShell';
import { finishOnboardingProgress, leaveOnboarding, useOnboardingStepMarker } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

type Outcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * One quiet second try: a write that fails for a passing reason (the database busy for a moment)
 * goes through on the retry, and the person never sees it. Throws count as failures too.
 */
async function withOneRetry(run: () => Promise<{ ok: boolean; error?: { message?: string } }>): Promise<Outcome> {
  let reason = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await run();
      if (result.ok) return { ok: true };
      reason = result.error?.message ?? '';
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return { ok: false, reason };
}

/** The real reason, short, under the toast: what to report if saving keeps failing on a phone. */
function reasonOf(outcome: Outcome): string | undefined {
  if (outcome.ok || !outcome.reason) return undefined;
  return outcome.reason.length > 90 ? `${outcome.reason.slice(0, 87)}...` : outcome.reason;
}

export function FirstTaskScreen() {
  const t = useTheme();
  const router = useRouter();
  const tight = useOnboardingDensity() === 'tight';
  const createTask = useCreateTask();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);
  useOnboardingStepMarker('/onboarding/first-task');

  const [name, setName] = useState('');
  const [ideal, setIdeal] = useState('');
  const [fallback, setFallback] = useState('');
  const [errors, setErrors] = useState<{ name?: string; ideal?: string; fallback?: string }>({});
  const [saving, setSaving] = useState(false);
  const createdRef = useRef(false);

  // A second tap in the same moment must not start a second save (and a second routine).
  const busyRef = useRef(false);
  async function handleSave() {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await save();
    } finally {
      busyRef.current = false;
    }
  }
  async function save() {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = S08_COPY.nameError;
    if (!ideal.trim()) nextErrors.ideal = S08_COPY.idealError;
    if (!fallback.trim()) nextErrors.fallback = S08_COPY.fallbackError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    // If the routine was saved on an earlier press and only the "onboarding finished" save failed,
    // a second press must not create the routine again.
    if (!createdRef.current) {
      const draft: TaskDraft = {
        type: 'routine',
        name: name.trim(),
        cadence: { kind: 'daily' },
        icon: 'Repeat',
        color: 'forge-orange',
        importance: 'med',
        necessity: 'recommended',
        isAsNeeded: false,
        isTracked: true,
        idealSteps: [{ text: ideal.trim(), dueWeekdays: null }],
        fallbackSteps: [{ text: fallback.trim(), dueWeekdays: null }],
      };
      // A thrown write must reach the calm retry toast too, or the Save button would spin for ever.
      const result = await withOneRetry(() => createTask.mutateAsync(draft));
      if (!result.ok) {
        setSaving(false);
        showToast(S08_COPY.saveFailure, 'warning', { detail: reasonOf(result) });
        return;
      }
      createdRef.current = true;
    }
    // Wait for this save too: without it onboarding would start again on the next launch.
    const finished = await withOneRetry(() => updateSettings.mutateAsync({ onboardingCompletedAt: now() }));
    if (!finished.ok) {
      setSaving(false);
      showToast(S08_COPY.saveFailure, 'warning', { detail: reasonOf(finished) });
      return;
    }
    await finishOnboardingProgress();
    setSaving(false);
    leaveOnboarding(router, '/today?justAdded=1' as Href);
  }

  // No helper line under each field: three of them cost the banner 66 px on every phone, and the
  // placeholders already show an example of each. An error still appears under its field.
  const field = (key: 'name' | 'ideal' | 'fallback', label: string, placeholder: string, value: string, set: (v: string) => void) => (
    <Input
      label={label}
      value={value}
      onChangeText={(v) => {
        set(v);
        if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
      }}
      placeholder={placeholder}
      dense={tight}
      error={errors[key]}
    />
  );

  return (
    <OnboardingShell step={7} icon={Plus} headline={S08_COPY.headline} body={S08_COPY.body} onNext={() => void handleSave()} nextLabel={S08_COPY.save} nextLoading={saving}>
      {field('name', S08_COPY.nameLabel, S08_COPY.namePlaceholder, name, setName)}
      {field('ideal', S08_COPY.idealLabel, S08_COPY.idealPlaceholder, ideal, setIdeal)}
      {field('fallback', S08_COPY.fallbackLabel, S08_COPY.fallbackPlaceholder, fallback, setFallback)}
      {/* On a short screen this line goes: the words above already say the routine is daily. */}
      {tight ? null : <Text style={[styles.note, { color: t.color.textMuted }]}>{S08_COPY.cadenceNote}</Text>}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({ note: { fontSize: FONT_SIZE.sm, lineHeight: 20 } });
