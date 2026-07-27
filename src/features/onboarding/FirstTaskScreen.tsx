/** S08 — Onboarding: First Task. route: /onboarding/first-task. Features: F9, F2. */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Calendar, ListChecks, Repeat, StickyNote } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { now } from '@/lib/date';
import { useCreateTask, useUpdateSettings } from '@/queries';
import { useToastStore } from '@/app-shell';
import { SPACE, useTheme } from '@/theme';
import { Button, Card, Input, Tag, type IconComponent } from '@/ui';
import type { TaskDraft } from '@/types';

import { S08_COPY } from './copy';
import { finishOnboardingProgress, useOnboardingStepMarker } from './useOnboardingResume';

const TILE_ICONS: readonly IconComponent[] = [Repeat, Calendar, ListChecks, StickyNote];

export function FirstTaskScreen() {
  const t = useTheme();
  const router = useRouter();
  const createTask = useCreateTask();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);
  useOnboardingStepMarker('/onboarding/first-task');

  const [name, setName] = useState('');
  const [ideal, setIdeal] = useState('');
  const [fallback, setFallback] = useState('');
  const [errors, setErrors] = useState<{ name?: string; ideal?: string; fallback?: string }>({});
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && ideal.trim().length > 0 && fallback.trim().length > 0;

  async function handleSave() {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = S08_COPY.nameError;
    if (!ideal.trim()) nextErrors.ideal = S08_COPY.idealError;
    if (!fallback.trim()) nextErrors.fallback = S08_COPY.fallbackError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    // S08's four silent defaults (MODULES.md M7 non-negotiable) — none surfaced as a choice
    // here, all editable later via the Manage Task Sheet / Icon & Color Picker (S20/S21).
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

    const result = await createTask.mutateAsync(draft);
    if (!result.ok) {
      setSaving(false);
      showToast(S08_COPY.saveFailure, 'warning');
      return;
    }

    void updateSettings.mutateAsync({ onboardingCompletedAt: now() });
    await finishOnboardingProgress();
    setSaving(false);
    router.replace('/today' as Href);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.lastStep, { color: t.color.textDim }]}>{S08_COPY.lastStep}</Text>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {S08_COPY.headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{S08_COPY.body}</Text>

        <View style={styles.typeRow}>
          {S08_COPY.tiles.map((tile, i) => {
            const Icon = TILE_ICONS[i]!;
            return (
              <Card
                key={tile.label}
                style={!tile.enabled ? styles.disabledTile : undefined}
                accessibilityLabel={tile.enabled ? `${tile.label}, selected` : `${tile.label}, unavailable until after setup`}
              >
                <Icon size={20} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
                <Text style={[styles.tileLabel, { color: t.color.text }]}>{tile.label}</Text>
                {'tag' in tile && tile.tag ? <Tag label={tile.tag} /> : null}
              </Card>
            );
          })}
        </View>

        <Input
          label={S08_COPY.nameLabel}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
          }}
          placeholder={S08_COPY.namePlaceholder}
          helper={errors.name ? undefined : S08_COPY.nameHelper}
          error={errors.name}
        />
        <Input
          label={S08_COPY.idealLabel}
          value={ideal}
          onChangeText={(v) => {
            setIdeal(v);
            if (errors.ideal) setErrors((e) => ({ ...e, ideal: undefined }));
          }}
          placeholder={S08_COPY.idealPlaceholder}
          helper={errors.ideal ? undefined : S08_COPY.idealHelper}
          error={errors.ideal}
        />
        <Input
          label={S08_COPY.fallbackLabel}
          value={fallback}
          onChangeText={(v) => {
            setFallback(v);
            if (errors.fallback) setErrors((e) => ({ ...e, fallback: undefined }));
          }}
          placeholder={S08_COPY.fallbackPlaceholder}
          helper={errors.fallback ? undefined : S08_COPY.fallbackHelper}
          error={errors.fallback}
        />
        <Text style={[styles.cadenceNote, { color: t.color.textMuted }]}>{S08_COPY.cadenceNote}</Text>
      </View>

      <View style={styles.footer}>
        <Button
          label={S08_COPY.save}
          onPress={handleSave}
          disabled={!canSave}
          loading={saving}
          accessibilityLabel={S08_COPY.save}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: SPACE.s3, gap: SPACE.s2 },
  lastStep: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  headline: { fontSize: 26, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginVertical: SPACE.s2 },
  disabledTile: { opacity: 0.5 },
  tileLabel: { fontSize: 13, fontWeight: '600' },
  cadenceNote: { fontSize: 13, lineHeight: 18 },
  footer: { padding: SPACE.s3 },
});
