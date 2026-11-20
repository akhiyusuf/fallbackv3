/** S41 — Settings. Grouped lists (D7) under bold headings (D19). */
import { useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Award, Bell, CalendarDays, Cloud, HardDrive, HelpCircle, History, Palette, Sparkles, SquareStack, type LucideIcon, Bot, Volume2 } from 'lucide-react-native';
import { useAgentAccessStore } from '@/features/agents/store';
import { StyleSheet, View } from 'react-native';

import { useEntitlementStore } from '@/app-shell';
import { S41_COPY } from '@/features/settings/copy';
import { useConsistency, useProgress, useSettings } from '@/queries';
import { initNotificationsBridge } from '@/services/notifications';
import { billing } from '@/services/billing';
import { initWidgetsBridge } from '@/services/widgets';
import { FONT_SIZE, RADIUS, useTheme } from '@/theme';
import { useSoundStore } from '@/services/sfx';
import { ListGroup, ListRow, Screen, Skeleton, Switch } from '@/ui';
import { Text } from '@/ui/AppText';

const ROW_ICON: Record<string, LucideIcon> = {
  Badges: Award,
  Records: CalendarDays,
  Notifications: Bell,
  'Theme and accent': Palette,
  Widgets: SquareStack,
  'Fallback AI subscription': Sparkles,
  'Conversation history': History,
  'AI agent access': Bot,
  'Account and sync': Cloud,
  Data: HardDrive,
  'Help and about': HelpCircle,
};

const ROW_ROUTE: Record<string, Href> = {
  Badges: '/achievements?from=settings' as Href,
  Records: '/records' as Href,
  Notifications: '/settings/notifications' as Href,
  'Theme and accent': '/settings/theme' as Href,
  Widgets: '/settings/widgets' as Href,
  'Fallback AI subscription': '/settings/subscription' as Href,
  'Conversation history': '/assistant/history' as Href,
  'AI agent access': '/settings/agents' as Href,
  'Account and sync': '/settings/sync' as Href,
  Data: '/settings/data' as Href,
  'Help and about': '/settings/help' as Href,
};

const ROW_LABEL: Record<string, string> = {
  'Theme and accent': 'Theme',
  'Fallback AI subscription': 'Subscription',
  'Account and sync': 'Account and sync',
  'Help and about': 'Help and about',
};

export default function S41SettingsHome() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const progressQuery = useProgress();
  const statQuery = useConsistency({ scope: 'aggregate', window: 'last-30' });
  const entitlement = useEntitlementStore((s) => s.entitlement);
  const agentsOn = useAgentAccessStore((s) => s.enabled);

  const loading = settingsQuery.isLoading || progressQuery.isLoading;
  const level = progressQuery.data?.level;
  const notificationsOn = settingsQuery.data?.notifications.master ?? false;
  const subscriptionActive = entitlement.status === 'active' || entitlement.status === 'trial';

  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
    // The subscription row reads the in-memory entitlement, which is empty after a cold start.
    // Load it from the store here, so a subscriber does not see "Free plan" until they open S44.
    void billing.refreshEntitlement();
  }, []);

  const soundsOn = useSoundStore((s) => s.on);
  const setSoundsOn = useSoundStore((s) => s.setOn);
  const stat = statQuery.isError
    ? S41_COPY.statLoadError
    : statQuery.data?.percent != null
      ? `${statQuery.data.percent}${S41_COPY.statSuffix}`
      : 'No data yet';

  return (
    <Screen title={S41_COPY.title} onBack={() => router.dismissTo('/today' as Href)}>
      {loading ? (
        <Skeleton height={76} radius={16} />
      ) : (
        <ListGroup>
          <ListRow
            leading={
              <View style={[styles.level, { backgroundColor: t.color.goldSoft, borderColor: t.color.celebrationGold }]}>
                <Text style={[styles.levelNumeral, { color: t.color.xp }]}>{level?.level ?? 1}</Text>
              </View>
            }
            label={level ? `${S41_COPY.levelPrefix} ${level.level} · ${level.title}` : S41_COPY.profileName}
            sublabel={stat}
            onPress={() => (statQuery.isError ? void statQuery.refetch() : router.push('/progress?from=settings' as Href))}
            accessibilityLabel={`${S41_COPY.profileName}. ${level ? `${S41_COPY.levelPrefix} ${level.level}, ${level.title}.` : ''} ${stat}. Opens your progress`}
          />
        </ListGroup>
      )}

      <ListGroup>
        <ListRow
          icon={Volume2}
          label="Sounds"
          sublabel="Small sounds when you log, tick and switch things."
          right={
            <Switch
              value={soundsOn}
              // The switch plays its own click after the change, so turning sounds on answers with a sound and off with silence.
              onValueChange={setSoundsOn}
              accessibilityLabel={`Sounds, ${soundsOn ? 'on' : 'off'}`}
            />
          }
        />
      </ListGroup>

      {S41_COPY.sections.map((section) => (
        <ListGroup key={section.label} title={section.label}>
          {section.rows.map((row) => {
            const value =
              row === 'Notifications' ? (notificationsOn ? 'On' : 'Off') : row === 'Fallback AI subscription' ? (subscriptionActive ? 'Active' : 'Free plan') : row === 'AI agent access' ? (agentsOn ? 'On' : 'Off') : undefined;
            return (
              <ListRow
                key={row}
                icon={ROW_ICON[row]}
                label={ROW_LABEL[row] ?? row}
                sublabel={S41_COPY.rowSubcopy[row]}
                value={value}
                onPress={() => router.push(ROW_ROUTE[row]!)}
              />
            );
          })}
        </ListGroup>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  level: { width: 44, height: 44, borderRadius: RADIUS.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  levelNumeral: { fontSize: FONT_SIZE.md, fontWeight: '700' },
});
