/**
 * S27 — Achievements    route: /achievements
 * Owner: M5. Features: F13, F29, F31.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S27)
 *
 * Origin-aware back: opened from S09 (Today) or S41 (Settings) — SITEMAP Decision 19.
 * Cycling XP label follows the ACTUAL active cadence (never a hardcoded "Monthly"). Tenure
 * badges show a calendar unlock condition only, are never gated on Cycling XP, and never
 * celebrate while locked.
 */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS } from '@/domain';
import { ROUTES, useOriginAwareBack, withOrigin } from '@/navigation';
import { useAchievements, useProgress, useSettings, useUpdateSettings } from '@/queries';
import type { AchievementCategory, CycleCadence } from '@/types';
import { SPACE, useTheme } from '@/theme';
import { Card, InlineRetryBanner, MilestoneBadge, Select, Skeleton, Tabs, XPBar } from '@/ui';

import { BADGE_ICONS } from '@/features/progress/badgeIcons';
import { OTHER_LOCKED_HINT, S27_COPY, SHOWING_UP_LOCKED_HINT, TENURE_OFFSETS } from '@/features/progress/copy';
import { formatDate, tenureUnlockDate } from '@/features/progress/format';
import { ProgressHeader } from '@/features/progress/ProgressHeader';
import type { LocalDate } from '@/types';

const CATEGORY_ORDER: readonly AchievementCategory[] = ['showing-up', 'fallback-wins', 'milestones', 'tenure'];

const FILTER_TABS = [
  { value: 'all', label: S27_COPY.tabs.all },
  { value: 'earned', label: S27_COPY.tabs.earned },
  { value: 'locked', label: S27_COPY.tabs.locked },
];

function lockedHintFor(key: string): string {
  return SHOWING_UP_LOCKED_HINT[key] ?? OTHER_LOCKED_HINT[key] ?? 'Locked.';
}

export default function S27Achievements() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.today);

  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const progressQuery = useProgress();
  const achievementsQuery = useAchievements();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();

  const isLoading = progressQuery.isLoading || achievementsQuery.isLoading || settingsQuery.isLoading;
  const isError = progressQuery.isError || achievementsQuery.isError || settingsQuery.isError;

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: t.color.bg }]}>
        <ProgressHeader title={S27_COPY.title} onBack={goBack} />
        <View style={styles.content}>
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={200} />
        </View>
      </View>
    );
  }

  if (isError || !progressQuery.data || !settingsQuery.data) {
    return (
      <View style={[styles.root, { backgroundColor: t.color.bg }]}>
        <ProgressHeader title={S27_COPY.title} onBack={goBack} />
        <View style={styles.content}>
          <InlineRetryBanner
            message={S27_COPY.errorMessage}
            onRetry={() => {
              progressQuery.refetch();
              achievementsQuery.refetch();
              settingsQuery.refetch();
            }}
            tone="warning"
          />
        </View>
      </View>
    );
  }

  const progress = progressQuery.data;
  const settings = settingsQuery.data;
  const unlocked = achievementsQuery.data ?? [];
  const unlockedKeys = new Set(unlocked.map((u) => u.key));
  const nonTenureEarned = unlocked.some((u) => !u.key.startsWith('tenure-'));

  function badgeVisible(earned: boolean): boolean {
    if (filter === 'earned') return earned;
    if (filter === 'locked') return !earned;
    return true;
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <ProgressHeader title={S27_COPY.title} onBack={goBack} />
      <View style={styles.content}>
        <Card accessibilityLabel="Lifetime XP">
          <XPBar
            title="Lifetime XP"
            valueLabel={`Level ${progress.level.level} · ${progress.level.title} · ${progress.level.xpIntoLevel}/${progress.level.xpForLevel} XP`}
            current={progress.level.xpIntoLevel}
            max={progress.level.xpForLevel}
          />
        </Card>

        <Card accessibilityLabel="Cycling XP">
          <XPBar
            title={S27_COPY.cadenceLabel[progress.cycleCadence]}
            valueLabel={`${progress.cyclingXp} XP`}
            current={progress.cyclingXp}
            max={null}
            subline={`${S27_COPY.resetsOnPrefix} ${formatDate(progress.currentCycle.endDate, progress.cycleCadence === 'weekly' ? 'EEE, MMM d' : 'MMM d')}`}
          />
          <Select
            label={S27_COPY.resetCadenceLabel}
            value={settings.cycleCadence}
            options={S27_COPY.cadenceOptions}
            onChange={(v) => updateSettings.mutate({ cycleCadence: v as CycleCadence })}
          />
        </Card>

        <Card onPress={() => router.push(withOrigin(ROUTES.records, 'achievements') as Href)} accessibilityLabel={S27_COPY.recordsLink}>
          <Text style={[styles.linkRow, { color: t.color.text }]}>{S27_COPY.recordsLink}</Text>
        </Card>

        {!nonTenureEarned ? (
          <Card accessibilityLabel={S27_COPY.newUserBanner}>
            <Text style={[styles.banner, { color: t.color.textMuted }]}>{S27_COPY.newUserBanner}</Text>
          </Card>
        ) : null}

        <Tabs items={FILTER_TABS} value={filter} onChange={(v) => setFilter(v as typeof filter)} accessibilityLabel="Filter badges" />

        {CATEGORY_ORDER.map((category) => {
          const defs = ACHIEVEMENTS.filter((a) => a.category === category);
          return (
            <View key={category} style={styles.categorySection}>
              <Text accessibilityRole="header" style={[styles.categoryHeader, { color: t.color.text }]}>
                {S27_COPY.categoryHeaders[category]}
              </Text>
              <View style={styles.badgeGrid}>
                {defs.map((def) => {
                  const earned = unlockedKeys.has(def.key);
                  if (!badgeVisible(earned)) return null;
                  const Icon = BADGE_ICONS[def.key];
                  if (!Icon) return null;
                  return (
                    <View key={def.key} style={styles.badgeColumn}>
                      <MilestoneBadge label={def.label} earned={earned} icon={Icon} onPress={() => setExpandedKey((k) => (k === def.key ? null : def.key))} />
                      {expandedKey === def.key ? (
                        <Card accessibilityLabel={`${def.label} detail`}>
                          <Text style={[styles.detailName, { color: t.color.text }]}>{def.label}</Text>
                          <Text style={[styles.detailBody, { color: t.color.textMuted }]}>
                            {earned
                              ? S27_COPY.earnedDetail(formatDate(unlocked.find((u) => u.key === def.key)!.unlockedOn))
                              : category === 'tenure'
                                ? tenureLockedLine(def.key, settings.tenureAnchorDate)
                                : lockedHintFor(def.key)}
                          </Text>
                          <Text style={[styles.detailDescription, { color: t.color.textDim }]}>{def.description}</Text>
                        </Card>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function tenureLockedLine(key: string, anchor: LocalDate): string {
  const date = tenureUnlockDate(key, anchor);
  const relative = TENURE_OFFSETS[key]?.relative ?? 'day one';
  return date ? S27_COPY.tenureLockedDetail(formatDate(date), relative) : 'Locked.';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  linkRow: { fontSize: 16, fontWeight: '600' },
  banner: { fontSize: 14, lineHeight: 20 },
  categorySection: { gap: SPACE.s2 },
  categoryHeader: { fontSize: 16, fontWeight: '700' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s3 },
  badgeColumn: { gap: SPACE.s1 },
  detailName: { fontSize: 15, fontWeight: '700' },
  detailBody: { fontSize: 13, lineHeight: 18 },
  detailDescription: { fontSize: 13, lineHeight: 18 },
});
