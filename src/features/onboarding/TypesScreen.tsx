/** S04 — Onboarding: Four ways to plan. route: /onboarding/types. Features: F9, F11. */
import { useRouter, type Href } from 'expo-router';
import { Calendar, ListChecks, Repeat, StickyNote } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { now } from '@/lib/date';
import { useUpdateSettings } from '@/queries';
import { SPACE, useTheme } from '@/theme';
import { Card, Tag, type IconComponent } from '@/ui';

import { S04_COPY } from './copy';
import { OnboardingShell } from './OnboardingShell';
import { finishOnboardingProgress, useOnboardingStepMarker } from './useOnboardingResume';

const TILE_ICONS: readonly IconComponent[] = [Repeat, Calendar, ListChecks, StickyNote];

export function TypesScreen() {
  const t = useTheme();
  const router = useRouter();
  const updateSettings = useUpdateSettings();
  useOnboardingStepMarker('/onboarding/types');

  async function handleSkip() {
    void updateSettings.mutateAsync({ onboardingCompletedAt: now() });
    await finishOnboardingProgress();
    router.replace('/today' as Href);
  }

  function handleNext() {
    router.push('/onboarding/consistency' as Href);
  }

  return (
    <OnboardingShell step={3} icon={Repeat} headline={S04_COPY.headline} body={S04_COPY.body} onNext={handleNext} onSkip={handleSkip}>
      <View style={styles.grid}>
        {S04_COPY.tiles.map((tile, i) => {
          const Icon = TILE_ICONS[i]!;
          return (
            <Card key={tile.label} accessibilityLabel={`${tile.label}. ${tile.helper}`}>
              <Icon size={22} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={[styles.tileLabel, { color: t.color.text }]}>{tile.label}</Text>
              <Text style={[styles.tileHelper, { color: t.color.textMuted }]}>{tile.helper}</Text>
              {'tag' in tile && tile.tag ? <Tag label={tile.tag} /> : null}
            </Card>
          );
        })}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  tileLabel: { fontSize: 15, fontWeight: '600' },
  tileHelper: { fontSize: 13, lineHeight: 18 },
});
