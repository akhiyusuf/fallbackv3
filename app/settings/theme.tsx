/**
 * S43 — Theme & Accent    route: /settings/theme
 * Owner: M7. Features: F8.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S43)
 */
import { useRouter, type Href } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeStore, useToastStore } from '@/app-shell';
import { S43_COPY } from '@/features/settings/copy';
import { SettingsHeader } from '@/features/settings/SettingsHeader';
import { useSettings, useUpdateSettings } from '@/queries';
import { ACCENTS, SPACE, useTheme } from '@/theme';
import { Button, Card, OffDayToggle, ProgressRing, Skeleton, StateChip } from '@/ui';
import type { AccentKey, ThemeMode } from '@/types';

const ACCENT_ORDER: readonly AccentKey[] = ['forge-orange', 'indigo', 'berry', 'plum'];

export default function S43ThemeAndAccent() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);

  function handleBack() {
    router.push('/settings' as Href);
  }

  async function handleModeChange(next: ThemeMode) {
    const prior = mode;
    setMode(next);
    const result = await updateSettings.mutateAsync({ theme: next });
    if (!result.ok) {
      setMode(prior);
      showToast(S43_COPY.errorToast, 'warning');
    }
  }

  async function handleAccentChange(next: AccentKey) {
    const prior = accent;
    setAccent(next);
    const result = await updateSettings.mutateAsync({ accent: next });
    if (!result.ok) {
      setAccent(prior);
      showToast(S43_COPY.errorToast, 'warning');
    }
  }

  if (settingsQuery.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: t.color.bg }]}>
        <SettingsHeader title={S43_COPY.title} onBack={handleBack} />
        <View style={styles.content}>
          <Skeleton height={80} />
          <Skeleton height={80} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <SettingsHeader title={S43_COPY.title} onBack={handleBack} />
      <View style={styles.content}>
        <Card accessibilityLabel={S43_COPY.appearanceLabel}>
          <Text style={[styles.sectionLabel, { color: t.color.text }]}>{S43_COPY.appearanceLabel}</Text>
          <View style={styles.optionRow} accessibilityRole="radiogroup" accessibilityLabel={S43_COPY.appearanceLabel}>
            {S43_COPY.appearanceOptions.map((option) => {
              const selected = mode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleModeChange(option.value as ThemeMode)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${S43_COPY.appearanceLabel}, ${option.label}${selected ? ' selected' : ''}`}
                  style={[styles.optionChip, { borderColor: selected ? t.accent.base : t.color.border, backgroundColor: selected ? t.accent.soft : t.color.bg }]}
                >
                  {selected ? <Check size={16} color={t.accent.deep} /> : null}
                  <Text style={[styles.optionLabel, { color: selected ? t.accent.deep : t.color.text }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card accessibilityLabel={S43_COPY.accentLabel}>
          <Text style={[styles.sectionLabel, { color: t.color.text }]}>{S43_COPY.accentLabel}</Text>
          <Text style={[styles.helper, { color: t.color.textMuted }]}>{S43_COPY.accentHelper}</Text>
          <View style={styles.swatchRow} accessibilityRole="radiogroup" accessibilityLabel={S43_COPY.accentLabel}>
            {ACCENT_ORDER.map((key) => {
              const selected = accent === key;
              const swatch = ACCENTS[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => handleAccentChange(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${S43_COPY.accentLabel}, ${swatch.label}${selected ? ' selected' : ''}`}
                  style={[styles.swatch, { backgroundColor: swatch.base }]}
                >
                  {selected ? <Check size={18} color={t.color.textOnAccent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card
          testID="theme-preview"
          accessibilityLabel="Live preview, a non-interactive illustrative example"
          accessibilityRole="summary"
        >
          <Text style={[styles.previewTaskName, { color: t.color.text }]}>{S43_COPY.previewTaskName}</Text>
          <Text style={[styles.previewTaskMeta, { color: t.color.textMuted }]}>{S43_COPY.previewTaskMeta}</Text>

          <View style={styles.chipRow} pointerEvents="none">
            <PreviewChip caption={S43_COPY.stateChipLabels.done} value="done" />
            <PreviewChip caption={S43_COPY.stateChipLabels.fallback} value="fallback" />
            <PreviewChip caption={S43_COPY.stateChipLabels.skip} value="skip" />
            <View style={styles.previewChipCol}>
              <OffDayToggle value onValueChange={() => {}} label="" accessibilityLabel={S43_COPY.stateChipLabels.off} />
              <Text style={[styles.previewCaption, { color: t.color.textMuted }]}>{S43_COPY.stateChipLabels.off}</Text>
            </View>
          </View>

          <View style={styles.previewCtaRow} pointerEvents="none">
            <Button label={S43_COPY.previewCta} onPress={() => {}} accessibilityLabel={S43_COPY.previewCta} />
            <ProgressRing percent={60} size={48} label="3/5" accessibilityLabel={S43_COPY.previewStat} />
          </View>

          <Text style={[styles.previewFootnote, { color: t.color.textDim }]}>{S43_COPY.previewCaption}</Text>
        </Card>
      </View>
    </View>
  );
}

function PreviewChip({ caption, value }: { caption: string; value: 'done' | 'fallback' | 'skip' }) {
  const t = useTheme();
  return (
    <View style={styles.previewChipCol}>
      <StateChip value={value} onChange={() => {}} disabled variant="compact" accessibilityLabel={caption} testID={`preview-chip-${value}`} />
      <Text style={[styles.previewCaption, { color: t.color.textMuted }]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  sectionLabel: { fontSize: 16, fontWeight: '600' },
  helper: { fontSize: 14, lineHeight: 20 },
  optionRow: { flexDirection: 'row', gap: SPACE.s2, flexWrap: 'wrap' },
  optionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: SPACE.s1, paddingHorizontal: SPACE.s2, minHeight: 44 },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  swatchRow: { flexDirection: 'row', gap: SPACE.s2 },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  previewTaskName: { fontSize: 16, fontWeight: '700' },
  previewTaskMeta: { fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginVertical: SPACE.s2 },
  previewChipCol: { alignItems: 'center', gap: 4 },
  previewCaption: { fontSize: 12 },
  previewCtaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  previewFootnote: { fontSize: 12, lineHeight: 18, marginTop: SPACE.s2 },
});
