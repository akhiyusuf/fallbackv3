/** S04 — onboarding step 3. Four equal tiles in a 2×2 grid, each with the coloured icon circle (D14). */
import { useRouter, type Href } from 'expo-router';
import { CalendarRange, ListTodo, Repeat, Timer } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ACCENTS, FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { TaskIcon, type IconComponent } from '@/ui';

import { S04_COPY } from './copy';
import { OnboardingShell, useOnboardingDensity } from './OnboardingShell';
import { useOnboardingStepMarker } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

const TILE_ICONS: readonly IconComponent[] = [Repeat, Timer, CalendarRange, ListTodo];
const TILE_COLORS = [ACCENTS['forge-orange'].base, ACCENTS.indigo.base, ACCENTS.berry.base, ACCENTS.plum.base];

export function TypesScreen() {
  const t = useTheme();
  const router = useRouter();
  useOnboardingStepMarker('/onboarding/types');
  const density = useOnboardingDensity();

  return (
    <OnboardingShell step={3} icon={Repeat} headline={S04_COPY.headline} body={S04_COPY.body} onNext={() => router.push('/onboarding/consistency' as Href)}>
      <View style={styles.grid}>
        {S04_COPY.tiles.map((tile, i) => (
          <View key={tile.label} style={[styles.tile, density === 'compact' && styles.tileCompact, density === 'tight' && styles.tileTight, { backgroundColor: t.color.bgAlt, borderColor: t.color.border }]} accessible accessibilityLabel={`${tile.label}. ${tile.helper}`}>
            {density === 'tight' ? (
              // A short screen: the icon moves beside the label, so each tile is a row shorter.
              <View style={styles.tileHead}>
                <TaskIcon icon={TILE_ICONS[i]!} color={TILE_COLORS[i]} size={28} />
                <Text style={[styles.tileLabel, styles.tileLabelTight, { color: t.color.text }]}>{tile.label}</Text>
              </View>
            ) : (
              <>
                <TaskIcon icon={TILE_ICONS[i]!} color={TILE_COLORS[i]} />
                <Text style={[styles.tileLabel, { color: t.color.text }]}>{tile.label}</Text>
              </>
            )}
            <Text style={[styles.tileHelper, density === 'tight' && styles.tileHelperTight, { color: t.color.textMuted }]}>{tile.helper}</Text>
          </View>
        ))}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 + 4 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 148, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.s3, gap: SPACE.s1 + 2 },
  tileCompact: { minHeight: 128, padding: SPACE.s2 + 4 },
  tileTight: { minHeight: 0, padding: SPACE.s2 + 2, gap: SPACE.s1 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  tileLabelTight: { marginTop: 0, flexShrink: 1, fontSize: 15, lineHeight: 19 },
  tileHelperTight: { fontSize: 13, lineHeight: 18 },
  tileLabel: { fontSize: FONT_SIZE.base, fontWeight: '600', marginTop: SPACE.s1 },
  tileHelper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
