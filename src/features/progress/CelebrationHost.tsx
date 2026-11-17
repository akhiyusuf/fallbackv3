/**
 * CelebrationHost — the milestone pop-up (D2). One component, one layout, one
 * dismiss label for level-ups, badges and tenure marks. Mounted once in
 * app/_layout.tsx; shown over the dimmed current screen.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ACHIEVEMENTS, levelFor } from '@/domain';
import { useCelebrationStore, type Celebration } from '@/app-shell/stores/celebration';
import { play } from '@/services/sfx';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { Button, Dialog, MilestoneBadge } from '@/ui';

import { BADGE_ICONS, LEVEL_UP_ICON } from './badgeIcons';
import { Confetti } from './Confetti';
import { S28_COPY, tenureBodyFor } from './copy';
import { Text } from '@/ui/AppText';

/** The shortest wait between earning a milestone and seeing it. */
const POP_DELAY_MS = 300;

export function CelebrationHost() {
  const t = useTheme();
  const current = useCelebrationStore((s) => s.queue[0]);
  const shift = useCelebrationStore((s) => s.shift);
  // A milestone waits its turn. The press that earned it has its own sound (and its own toast);
  // the pop-up and its sound arrive together once that sound has finished and a breath has
  // passed (`play` holds a reward back while anything else is sounding). Two milestones earned
  // at once are shown one after the other, each on the same terms.
  const [arrived, setArrived] = useState<Celebration | null>(null);
  useEffect(() => {
    if (!current) return;
    return play(current.kind === 'badge' ? 'badge_earned' : 'level_up', POP_DELAY_MS, () => setArrived(current));
  }, [current]);
  if (!current || arrived !== current) return null;

  let badgeLabel: string;
  let Icon = LEVEL_UP_ICON;
  let headline: string;
  let subhead: string | null = null;
  let body: string;

  if (current.kind === 'level-up') {
    const level = levelFor(current.lifetimeXp);
    badgeLabel = `Level ${level.level}`;
    headline = S28_COPY.levelUpHeadline(level.level);
    subhead = S28_COPY.levelUpSubhead(level.title);
    body = S28_COPY.levelUpBody(level.level);
  } else {
    const def = ACHIEVEMENTS.find((a) => a.key === current.badgeKey);
    badgeLabel = def?.label ?? '';
    Icon = BADGE_ICONS[current.badgeKey] ?? LEVEL_UP_ICON;
    const isTenure = current.badgeKey.startsWith('tenure-');
    headline = isTenure ? S28_COPY.tenureHeadline(badgeLabel) : S28_COPY.badgeHeadline(badgeLabel);
    body = isTenure ? tenureBodyFor(current.badgeKey) : (def?.description ?? S28_COPY.forwardLine);
  }

  return (
    <Dialog visible onClose={shift} presentation="center" accessibilityLabel={headline}>
      <Confetti />
      <View style={styles.center}>
        <MilestoneBadge label={badgeLabel} earned icon={Icon} />
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {headline}
        </Text>
        {subhead ? <Text style={[styles.subhead, { color: t.color.xp }]}>{subhead}</Text> : null}
        <Text style={[styles.body, { color: t.color.textMuted }]}>{body}</Text>
      </View>
      <Button label={S28_COPY.dismissButton} onPress={shift} accessibilityLabel={S28_COPY.dismissButton} fullWidth />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: SPACE.s2, paddingBottom: SPACE.s2 },
  headline: { fontSize: FONT_SIZE.xl, fontWeight: '700', textAlign: 'center' },
  subhead: { fontSize: FONT_SIZE.base, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: FONT_SIZE.base, lineHeight: 24, textAlign: 'center' },
});
