/**
 * S41 — Settings Home    route: /settings
 * Owner: M7. Features: F8, F13, F14, F17, F19, F20, F21, F25.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S41)
 */
import { useRouter, type Href } from 'expo-router';
import {
  Award,
  Bell,
  CalendarDays,
  ChevronRight,
  Cloud,
  HardDrive,
  HelpCircle,
  History,
  Palette,
  Sparkles,
  SquareStack,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useEntitlementStore } from '@/app-shell';
import { S41_COPY } from '@/features/settings/copy';
import { useConsistency, useProgress, useSettings } from '@/queries';
import { SPACE, useTheme } from '@/theme';
import { Badge, Button, Card, IconButton, Skeleton } from '@/ui';
import { ChevronLeft } from 'lucide-react-native';

const ROW_ICON: Record<string, LucideIcon> = {
  Badges: Award,
  Records: CalendarDays,
  Notifications: Bell,
  'Theme & accent': Palette,
  Widgets: SquareStack,
  'Fallback AI subscription': Sparkles,
  'Conversation history': History,
  'Account & sync': Cloud,
  Data: HardDrive,
  'Help & about': HelpCircle,
};

const ROW_ROUTE: Record<string, Href> = {
  Badges: '/achievements' as Href,
  Records: '/records' as Href,
  Notifications: '/settings/notifications' as Href,
  'Theme & accent': '/settings/theme' as Href,
  Widgets: '/settings/widgets' as Href,
  'Fallback AI subscription': '/settings/subscription' as Href,
  'Conversation history': '/assistant/history' as Href,
  'Account & sync': '/settings/sync' as Href,
  Data: '/settings/data' as Href,
  'Help & about': '/settings/help' as Href,
};

export default function S41SettingsHome() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const progressQuery = useProgress();
  const statQuery = useConsistency({ scope: 'aggregate', window: 'last-30' });
  const entitlement = useEntitlementStore((s) => s.entitlement);

  const loading = settingsQuery.isLoading || progressQuery.isLoading;
  const level = progressQuery.data?.level;
  const notificationsOn = settingsQuery.data?.notifications.master ?? false;
  const subscriptionActive = entitlement.status === 'active' || entitlement.status === 'trial';

  return (
    <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <IconButton icon={ChevronLeft} onPress={() => router.push('/today' as Href)} accessibilityLabel="Back" />
        <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
          {S41_COPY.title}
        </Text>
      </View>

      <Card
        onPress={() => router.push('/progress' as Href)}
        accessibilityLabel={
          level && statQuery.data
            ? `${S41_COPY.profileName}, ${S41_COPY.levelPrefix} ${level.level}, ${level.title}, ${statQuery.data.percent ?? 'no'}${S41_COPY.statSuffix}, opens your progress`
            : `${S41_COPY.profileName}, opens your progress`
        }
      >
        {loading ? (
          <>
            <Skeleton width={48} height={48} radius={24} />
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={16} />
          </>
        ) : (
          <>
            <View style={[styles.avatar, { backgroundColor: t.accent.soft }]}>
              <Text style={[styles.avatarInitial, { color: t.accent.deep }]}>M</Text>
            </View>
            <Text style={[styles.profileName, { color: t.color.text }]}>{S41_COPY.profileName}</Text>
            <Text style={[styles.profileSubline, { color: t.color.textMuted }]}>
              {level ? `${S41_COPY.levelPrefix} ${level.level} · ${level.title}` : ''}
            </Text>
            {statQuery.isError ? (
              <View style={styles.statError}>
                <Text style={[styles.errorText, { color: t.color.textMuted }]}>{S41_COPY.statLoadError}</Text>
                <Button label={S41_COPY.retry} onPress={() => statQuery.refetch()} variant="ghost" accessibilityLabel={S41_COPY.retry} />
              </View>
            ) : (
              <Text style={[styles.profileStat, { color: t.color.textMuted }]}>
                {statQuery.data?.percent != null ? `${statQuery.data.percent}${S41_COPY.statSuffix}` : 'no data yet'}
              </Text>
            )}
          </>
        )}
      </Card>

      {S41_COPY.sections.map((section) => (
        <Card key={section.label} accessibilityLabel={section.label}>
          <Text style={[styles.sectionLabel, { color: t.color.textMuted }]}>{section.label}</Text>
          {section.rows.map((row) => {
            const Icon = ROW_ICON[row]!;
            const subcopy = S41_COPY.rowSubcopy[row];
            const badge =
              row === 'Notifications'
                ? notificationsOn
                  ? 'On'
                  : 'Off'
                : row === 'Fallback AI subscription'
                  ? subscriptionActive
                    ? 'Active'
                    : 'Free'
                  : null;
            return (
              <Card key={row} onPress={() => router.push(ROW_ROUTE[row]!)} accessibilityLabel={`${row}, opens ${row}`} style={styles.row}>
                <Icon size={20} color={t.color.textMuted} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: t.color.text }]}>{row}</Text>
                  {subcopy ? <Text style={[styles.rowSubcopy, { color: t.color.textMuted }]}>{subcopy}</Text> : null}
                </View>
                {badge ? <Badge label={badge} /> : null}
                <ChevronRight size={18} color={t.color.textDim} />
              </Card>
            );
          })}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  title: { fontSize: 28, fontWeight: '700' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '700' },
  profileName: { fontSize: 18, fontWeight: '700' },
  profileSubline: { fontSize: 14 },
  profileStat: { fontSize: 14, fontWeight: '600' },
  statError: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  errorText: { fontSize: 14 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  rowSubcopy: { fontSize: 13 },
});
