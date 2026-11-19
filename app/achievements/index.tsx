/**
 * S27 — Achievements    route: /achievements
 * Level and cycle XP, cycle records, and the badge grid — four across (D16),
 * with the badge detail in a bottom sheet (D3).
 */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { History } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ACHIEVEMENTS } from '@/domain';
import { ROUTES, useOriginAwareBack, withOrigin } from '@/navigation';
import { useAchievements, useProgress, useSettings, useUpdateSettings } from '@/queries';
import type { AchievementCategory, CycleCadence, LocalDate } from '@/types';
import { FONT_SIZE, INK, mix, RADIUS, SPACE, useTheme } from '@/theme';
import { Card, Dialog, EmptyLine, InlineRetryBanner, ListGroup, ListRow, MilestoneBadge, Radio, Screen, SectionHeading, Skeleton, Tabs, XPBar } from '@/ui';

import { useToastStore } from '@/app-shell';
import { SAVE_FAILED } from '@/features/task/formShared';
import { BADGE_ICONS } from '@/features/progress/badgeIcons';
import { OTHER_LOCKED_HINT, S27_COPY, SHOWING_UP_LOCKED_HINT, TENURE_OFFSETS } from '@/features/progress/copy';
import { formatDate, tenureUnlockDate } from '@/features/progress/format';
import { Text } from '@/ui/AppText';

const CATEGORY_ORDER: readonly AchievementCategory[] = ['showing-up', 'fallback-wins', 'milestones', 'tenure'];

const FILTER_TABS = [
  { value: 'all', label: S27_COPY.tabs.all },
  { value: 'earned', label: S27_COPY.tabs.earned },
  { value: 'locked', label: S27_COPY.tabs.locked },
];

function lockedHintFor(key: string): string {
  return SHOWING_UP_LOCKED_HINT[key] ?? OTHER_LOCKED_HINT[key] ?? 'Locked.';
}

function tenureLockedLine(key: string, anchor: LocalDate): string {
  const date = tenureUnlockDate(key, anchor);
  const relative = TENURE_OFFSETS[key]?.relative ?? 'day one';
  return date ? S27_COPY.tenureLockedDetail(formatDate(date), relative) : 'Locked.';
}

export default function S27Achievements() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.today);

  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const progressQuery = useProgress();
  const achievementsQuery = useAchievements();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const showSaveToast = useToastStore((st) => st.show);
  // The reset rhythm is a saved setting: say so if it did not save, rather than leaving the
  // choice showing until the next launch quietly brings the old one back.
  async function changeCadence(next: CycleCadence) {
    const result = await updateSettings.mutateAsync({ cycleCadence: next }).catch(() => ({ ok: false as const }));
    if (!result.ok) showSaveToast(SAVE_FAILED, 'warning');
  }

  const isLoading = progressQuery.isLoading || achievementsQuery.isLoading || settingsQuery.isLoading;
  const isError = progressQuery.isError || achievementsQuery.isError || settingsQuery.isError;

  if (isLoading) {
    return (
      <Screen title={S27_COPY.title} level="page" onBack={goBack}>
        <Skeleton height={90} />
        <Skeleton height={90} />
        <Skeleton height={200} />
      </Screen>
    );
  }

  if (isError || !progressQuery.data || !settingsQuery.data) {
    return (
      <Screen title={S27_COPY.title} level="page" onBack={goBack}>
        <InlineRetryBanner
          message={S27_COPY.errorMessage}
          onRetry={() => {
            progressQuery.refetch();
            achievementsQuery.refetch();
            settingsQuery.refetch();
          }}
          tone="warning"
        />
      </Screen>
    );
  }

  const progress = progressQuery.data;
  const settings = settingsQuery.data;
  const unlocked = achievementsQuery.data ?? [];
  const unlockedKeys = new Set(unlocked.map((u) => u.key));
  const nonTenureEarned = unlocked.some((u) => !u.key.startsWith('tenure-'));

  const openDef = openKey ? ACHIEVEMENTS.find((a) => a.key === openKey) : undefined;
  const openEarned = openKey ? unlockedKeys.has(openKey) : false;
  const OpenIcon = openKey ? BADGE_ICONS[openKey] : undefined;

  return (
    <Screen title={S27_COPY.title} level="page" onBack={goBack}>
      <Card accessibilityLabel={`Level ${progress.level.level}, ${progress.level.title}. ${progress.level.xpIntoLevel} of ${progress.level.xpForLevel} XP`} style={styles.card}>
        <View style={styles.levelRow}>
          <View style={[styles.medal, { backgroundColor: t.color.celebrationGold, borderColor: t.color.celebrationGold, borderBottomColor: mix(t.color.celebrationGold, INK, 0.28) }]}>
            <Text style={styles.medalNumber}>{progress.level.level}</Text>
          </View>
          <View style={styles.levelText}>
            <Text style={[styles.levelKicker, { color: t.color.textMuted }]}>{`Level ${progress.level.level}`}</Text>
            <Text numberOfLines={1} style={[styles.levelTitle, { color: t.color.text }]}>
              {progress.level.title}
            </Text>
          </View>
        </View>
        <View style={[styles.xpTrack, { backgroundColor: t.color.surface }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: progress.level.xpForLevel, now: progress.level.xpIntoLevel }}>
          <View style={[styles.xpFill, { backgroundColor: t.color.xpFill, width: `${Math.max(4, Math.min(100, (progress.level.xpIntoLevel / Math.max(1, progress.level.xpForLevel)) * 100))}%` }]} />
        </View>
        <View style={styles.xpRow}>
          <Text style={[styles.xpStrong, { color: t.color.text }]}>{`${Math.max(0, progress.level.xpForLevel - progress.level.xpIntoLevel)} XP to level ${progress.level.level + 1}`}</Text>
          <Text style={[styles.note, { color: t.color.textMuted }]}>{S27_COPY.lifetimeSubline(progress.lifetimeXp)}</Text>
        </View>
      </Card>

      <Card accessibilityLabel={S27_COPY.cadenceLabel[progress.cycleCadence]} style={styles.card}>
        <XPBar
          title={S27_COPY.cadenceLabel[progress.cycleCadence]}
          valueLabel={`${progress.cyclingXp} XP`}
          current={progress.cyclingXp}
          max={null}
          subline={`${S27_COPY.resetsOnPrefix} ${formatDate(progress.currentCycle.endDate, progress.cycleCadence === 'weekly' ? 'EEE, MMM d' : 'MMM d')}`}
        />
        <Radio label={S27_COPY.resetCadenceLabel} value={settings.cycleCadence} options={S27_COPY.cadenceOptions} onChange={(v) => void changeCadence(v as CycleCadence)} />
      </Card>

      <ListGroup>
        <ListRow icon={History} label={S27_COPY.recordsLink} sublabel={S27_COPY.recordsSub} onPress={() => router.push(withOrigin(ROUTES.records, 'achievements') as Href)} />
      </ListGroup>

      <View style={styles.section}>
        <SectionHeading>{S27_COPY.badgesHeading}</SectionHeading>
        {!nonTenureEarned ? <Text style={[styles.note, { color: t.color.textMuted }]}>{S27_COPY.newUserBanner}</Text> : null}
        <Tabs items={FILTER_TABS} value={filter} onChange={(v) => setFilter(v as typeof filter)} accessibilityLabel="Filter badges" />
      </View>

      {CATEGORY_ORDER.map((category) => {
        const defs = ACHIEVEMENTS.filter((a) => a.category === category && BADGE_ICONS[a.key]);
        const visible = defs.filter((def) => {
          const earned = unlockedKeys.has(def.key);
          return filter === 'all' || (filter === 'earned' ? earned : !earned);
        });
        return (
          <View key={category} style={styles.section}>
            <Text accessibilityRole="header" style={[styles.categoryHeader, { color: t.color.text }]}>
              {S27_COPY.categoryHeaders[category]}
            </Text>
            {visible.length === 0 ? (
              <EmptyLine>{filter === 'earned' ? S27_COPY.noneEarned : S27_COPY.noneLocked}</EmptyLine>
            ) : (
              <View style={styles.badgeGrid}>
                {visible.map((def) => (
                  <View key={def.key} style={styles.badgeCell}>
                    <MilestoneBadge label={def.label} earned={unlockedKeys.has(def.key)} icon={BADGE_ICONS[def.key]!} onPress={() => setOpenKey(def.key)} />
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <Dialog visible={!!openDef} onClose={() => setOpenKey(null)} title={openDef?.label} accessibilityLabel={`${openDef?.label ?? 'Badge'} detail`} showClose>
        {openDef && OpenIcon ? (
          <View style={styles.detail}>
            <MilestoneBadge label={openEarned ? S27_COPY.tabs.earned : S27_COPY.tabs.locked} earned={openEarned} icon={OpenIcon} />
            <Text style={[styles.detailBody, { color: t.color.text }]}>
              {openEarned
                ? S27_COPY.earnedDetail(formatDate(unlocked.find((u) => u.key === openDef.key)!.unlockedOn))
                : openDef.category === 'tenure'
                  ? tenureLockedLine(openDef.key, settings.tenureAnchorDate)
                  : lockedHintFor(openDef.key)}
            </Text>
            <Text style={[styles.note, styles.centered, { color: t.color.textMuted }]}>{openDef.description}</Text>
          </View>
        ) : null}
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.s3 },
  section: { gap: SPACE.s2 + 4 },
  note: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  centered: { textAlign: 'center' },
  categoryHeader: { fontSize: FONT_SIZE.base, fontWeight: '800' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  medal: { width: 64, height: 64, borderRadius: RADIUS.pill, borderWidth: 2, borderBottomWidth: 6, alignItems: 'center', justifyContent: 'center' },
  medalNumber: { fontSize: FONT_SIZE.xl, lineHeight: 30, fontWeight: '800', color: INK, fontVariant: ['tabular-nums'] },
  levelText: { flex: 1, gap: 2 },
  levelKicker: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  levelTitle: { fontSize: FONT_SIZE.xl, lineHeight: 28, fontWeight: '800' },
  xpTrack: { height: 16, borderRadius: RADIUS.pill, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: RADIUS.pill },
  xpRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.s2, flexWrap: 'wrap' },
  xpStrong: { fontSize: FONT_SIZE.base, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.s3 },
  badgeCell: { width: '25%', alignItems: 'center', paddingHorizontal: 2 },
  detail: { alignItems: 'center', gap: SPACE.s2 + 4 },
  detailBody: { fontSize: FONT_SIZE.base, lineHeight: 24, textAlign: 'center' },
});
