/**
 * S43 — Theme. Appearance (D9), named themes with a small preview of each, and a strict set of
 * extra colours. Every theme, named or not, is derived from one seed colour by `@/theme/engine`,
 * so all of them pass the same contrast checks. The preview is the real Today card.
 */
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Check, Dumbbell } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeStore, useToastStore } from '@/app-shell';
import { S43_COPY } from '@/features/settings/copy';
import { TodayTaskCard } from '@/features/today/TodayTaskCard';
import { useSettings, useUpdateSettings } from '@/queries';
import { buildTheme, FONT_SIZE, RADIUS, seedForHue, SPACE, THEME_HUES, THEME_LABELS, THEME_ORDER, themeSeed, useTheme } from '@/theme';
import { Radio, Screen, SectionHeading, Skeleton } from '@/ui';
import type { AccentKey, ChipState, ThemeMode } from '@/types';
import { Text } from '@/ui/AppText';

function hueName(hue: number): string {
  if (hue >= 40 && hue < 100) return 'Amber';
  if (hue >= 170 && hue < 230) return 'Teal';
  if (hue >= 270 && hue < 306) return 'Violet';
  if (hue >= 306 && hue < 342) return 'Magenta';
  return 'Rose';
}

function ThemeCard({ themeKey, label, selected, onPress }: { themeKey: AccentKey; label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const d = buildTheme(t.scheme, themeKey);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
      style={[styles.themeCard, { backgroundColor: t.color.bgAlt, borderColor: selected ? t.accent.text : t.color.border, borderWidth: selected ? 2 : 1, margin: selected ? 0 : 1 }]}
    >
      <View style={[styles.themeTop, { backgroundColor: d.accent.fill }]}>
        <View style={[styles.themeRing, { borderColor: d.accent.onLarge }]} />
        <View style={[styles.themeBar, { backgroundColor: d.accent.onLarge }]} />
      </View>
      <View style={[styles.themeMid, { backgroundColor: d.color.bg }]}>
        <View style={[styles.themePill, { backgroundColor: d.color.idealSoft }]} />
        <View style={[styles.themePill, { backgroundColor: d.color.fallbackSoft }]} />
      </View>
      <View style={styles.themeName}>
        <Text numberOfLines={1} style={[styles.themeLabel, { color: t.color.text }]}>
          {label}
        </Text>
        {selected ? <Check size={16} color={t.accent.text} /> : null}
      </View>
    </Pressable>
  );
}

export default function S43Theme() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);
  const [previewChip, setPreviewChip] = useState<ChipState>('todo');
  const [previewReopened, setPreviewReopened] = useState(false);
  // The look is saved with the settings row. The splash screen restores it at start-up, but this
  // screen also restores it when it is the first screen opened, so it never shows a default.
  const savedMode = settingsQuery.data?.theme;
  const savedAccent = settingsQuery.data?.accent;
  useEffect(() => {
    if (savedMode && savedAccent) useThemeStore.getState().hydrate(savedMode, savedAccent);
  }, [savedMode, savedAccent]);

  function handleBack() {
    router.push('/settings' as Href);
  }

  async function handleModeChange(next: ThemeMode) {
    const prior = mode;
    setMode(next);
    const saved = await updateSettings.mutateAsync({ theme: next }).then(
      (r) => r.ok,
      () => false,
    );
    if (!saved) {
      // Undo only if the screen still shows this choice; a later tap has already replaced it.
      if (useThemeStore.getState().mode === next) setMode(prior);
      showToast(S43_COPY.errorToast, 'warning');
    }
  }

  async function handleAccentChange(next: AccentKey) {
    const prior = accent;
    setAccent(next);
    const saved = await updateSettings.mutateAsync({ accent: next }).then(
      (r) => r.ok,
      () => false,
    );
    if (!saved) {
      if (useThemeStore.getState().accent === next) setAccent(prior);
      showToast(S43_COPY.errorToast, 'warning');
    }
  }

  if (settingsQuery.isLoading) {
    return (
      <Screen title="Theme" onBack={handleBack}>
        <Skeleton height={80} radius={16} />
        <Skeleton height={80} radius={16} />
      </Screen>
    );
  }

  return (
    <Screen title="Theme" onBack={handleBack}>
      <View style={styles.block}>
        <SectionHeading>{S43_COPY.appearanceLabel}</SectionHeading>
        <Radio label="" value={mode} options={S43_COPY.appearanceOptions} onChange={(v) => void handleModeChange(v as ThemeMode)} />
      </View>

      <View style={styles.block}>
        <SectionHeading>Theme</SectionHeading>
        <View style={styles.themeGrid} accessibilityRole="radiogroup" accessibilityLabel="Theme">
          {THEME_ORDER.map((key) => (
            <ThemeCard key={key} themeKey={key} label={THEME_LABELS[key]} selected={accent === key} onPress={() => void handleAccentChange(key)} />
          ))}
        </View>
        <Text style={[styles.helper, { color: t.color.textMuted }]}>{S43_COPY.accentHelper}</Text>
      </View>

      <View style={styles.block}>
        <SectionHeading>{S43_COPY.moreColoursLabel}</SectionHeading>
        <View style={styles.swatchRow} accessibilityRole="radiogroup" accessibilityLabel={S43_COPY.moreColoursLabel}>
          {THEME_HUES.map((hue, i) => {
            const key: AccentKey = `hue-${hue}`;
            const selected = accent === key;
            return (
              <Pressable
                key={key}
                onPress={() => void handleAccentChange(key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${hueName(hue)}, colour ${i + 1} of ${THEME_HUES.length}${selected ? ', selected' : ''}`}
                style={[styles.swatch, { backgroundColor: seedForHue(hue), borderColor: selected ? t.color.text : t.color.bg }]}
              >
                {selected ? <Check size={20} color={t.color.textOnAccent} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.helper, { color: t.color.textMuted }]}>{S43_COPY.moreColoursHelper}</Text>
      </View>

      <View style={styles.block}>
        <SectionHeading>Preview</SectionHeading>
        <View testID="theme-preview" accessibilityLabel="Preview, an example only" style={styles.preview}>
          <TodayTaskCard
            name={S43_COPY.previewTaskName}
            icon={Dumbbell}
            color={accent === 'mono' ? undefined : themeSeed(accent)}
            meta={['Routine', 'Daily']}
            chip={previewChip}
            reopened={previewReopened}
            idealHint={S43_COPY.previewIdeal}
            fallbackHint={S43_COPY.previewFallback}
            onLog={(chip) => {
              setPreviewChip(chip);
              setPreviewReopened(false);
            }}
            onToggleReopen={() => setPreviewReopened((v) => !v)}
          />
          <Text style={[styles.helper, { color: t.color.textMuted }]}>{S43_COPY.previewNote}</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.s2 + 4 },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  themeCard: { flexBasis: '30%', flexGrow: 1, maxWidth: '32%', borderRadius: RADIUS.md, overflow: 'hidden' },
  themeTop: { height: 34, flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, paddingHorizontal: SPACE.s2 },
  themeRing: { width: 16, height: 16, borderRadius: RADIUS.pill, borderWidth: 3 },
  themeBar: { flex: 1, height: 5, borderRadius: 3 },
  themeMid: { flexDirection: 'row', gap: SPACE.s1, padding: SPACE.s1 + 2 },
  themePill: { flex: 1, height: 12, borderRadius: 6 },
  themeName: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s1, paddingHorizontal: SPACE.s2, minHeight: 36 },
  themeLabel: { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  swatch: { width: 44, height: 44, borderRadius: RADIUS.pill, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  preview: { gap: SPACE.s2 },
});
