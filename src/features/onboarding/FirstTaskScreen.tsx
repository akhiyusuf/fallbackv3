/** S08 — onboarding step 7: add the first routine. Same top bar as every other step (D6). */
import { useState } from 'react';
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
import { finishOnboardingProgress, useOnboardingStepMarker } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

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

  async function handleSave() {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = S08_COPY.nameError;
    if (!ideal.trim()) nextErrors.ideal = S08_COPY.idealError;
    if (!fallback.trim()) nextErrors.fallback = S08_COPY.fallbackError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
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
    const result = await createTask.mutateAsync(draft).catch(() => ({ ok: false as const }));
    if (!result.ok) {
      setSaving(false);
      showToast(S08_COPY.saveFailure, 'warning');
      return;
    }
    void updateSettings.mutateAsync({ onboardingCompletedAt: now() });
    await finishOnboardingProgress();
    setSaving(false);
    router.replace('/today?justAdded=1' as Href);
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
