/**
 * S02 — onboarding step 2: why a plan B is worth having. The same week shown twice, with and
 * without a fallback. (The picture above is the plant; this is the proof, not a copy of it.)
 */
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Card, WeekStrip, type WeekDayState } from '@/ui';

import { S02_COPY } from './copy';
import { OnboardingShell, useOnboardingDensity } from './OnboardingShell';
import { useOnboardingStepMarker } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
/** Three good days and four hard ones. Only the hard days differ between the two rows. */
const WITHOUT: readonly WeekDayState[] = ['ideal', 'missed', 'missed', 'ideal', 'missed', 'ideal', 'missed'];
const WITH: readonly WeekDayState[] = ['ideal', 'fallback', 'fallback', 'ideal', 'fallback', 'ideal', 'fallback'];

function week(states: readonly WeekDayState[]) {
  return states.map((state, i) => ({ key: String(i), label: LETTERS[i] ?? '', state }));
}

export function HookScreen() {
  const t = useTheme();
  const router = useRouter();
  const tight = useOnboardingDensity() === 'tight';
  useOnboardingStepMarker('/onboarding/hook');
  return (
    <OnboardingShell step={2} headline={S02_COPY.headline} body={S02_COPY.body} onNext={() => router.push('/onboarding/types' as Href)}>
      <Card accessibilityLabel={`${S02_COPY.compareTitle}. ${S02_COPY.withoutLabel}: ${S02_COPY.withoutCount}. ${S02_COPY.withLabel}: ${S02_COPY.withCount}.`} style={[styles.card, tight && styles.cardTight]}>
        <Text style={[styles.title, { color: t.color.textMuted }]}>{S02_COPY.compareTitle}</Text>
        <View style={[styles.row, tight && styles.rowTight]}>
          <View style={styles.rowHead}>
            <Text style={[styles.label, { color: t.color.text }]}>{S02_COPY.withoutLabel}</Text>
            <Text style={[styles.count, { color: t.color.textMuted }]}>{S02_COPY.withoutCount}</Text>
          </View>
          <WeekStrip days={week(WITHOUT)} size={tight ? 24 : 26} />
        </View>
        <View style={[styles.rule, { backgroundColor: t.color.border }]} />
        <View style={[styles.row, tight && styles.rowTight]}>
          <View style={styles.rowHead}>
            <Text style={[styles.label, { color: t.color.text }]}>{S02_COPY.withLabel}</Text>
            <Text style={[styles.count, { color: t.color.idealDeep }]}>{S02_COPY.withCount}</Text>
          </View>
          <WeekStrip days={week(WITH)} size={tight ? 24 : 26} />
        </View>
      </Card>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.s2 + 4 },
  cardTight: { gap: SPACE.s2, padding: SPACE.s2 + 4 },
  rowTight: { gap: SPACE.s1 + 2 },
  title: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  row: { gap: SPACE.s2 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.s2 },
  label: { fontSize: FONT_SIZE.base, fontWeight: '800' },
  count: { fontSize: FONT_SIZE.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rule: { height: 1 },
});
