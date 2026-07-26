/**
 * S45 — Account & Sync    route: /settings/sync
 * Owner: M1. Features: F20.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S45)
 *
 * Platform-equivalent Switch label resolved per the spec's own allowance ("iCloud sync
 * (iOS) / platform-equivalent label") — Android has no iCloud, so it reads "Cloud sync".
 */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { now } from '@/lib/date';
import { getSyncProvider } from '@/services/sync';
import { S45_COPY } from '@/features/data/copy';
import { SettingsHeader } from '@/features/data/SettingsHeader';
import { useSettings, useUpdateSettings } from '@/queries';
import { SPACE, useTheme } from '@/theme';
import { Card, InlineRetryBanner, Skeleton, Switch } from '@/ui';

export default function S45AccountAndSync() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const [syncing, setSyncing] = useState(false);

  function handleBack() {
    router.replace('/settings' as Href);
  }

  async function handleToggle(next: boolean) {
    const patchResult = await updateSettings.mutateAsync({ sync: { enabled: next, lastSyncedAt: null, lastError: null } });
    if (!patchResult.ok || !next) return;

    // "After a brief simulated sync, status updates" — a real best-effort push attempt.
    setSyncing(true);
    const provider = getSyncProvider();
    const pushResult = await provider.push();
    setSyncing(false);
    if (pushResult.ok) {
      await updateSettings.mutateAsync({ sync: { enabled: true, lastSyncedAt: pushResult.value, lastError: null } });
    } else {
      await updateSettings.mutateAsync({ sync: { enabled: true, lastSyncedAt: null, lastError: pushResult.error.message } });
    }
  }

  async function handleRetry() {
    setSyncing(true);
    const pushResult = await getSyncProvider().push();
    setSyncing(false);
    if (pushResult.ok) {
      await updateSettings.mutateAsync({ sync: { enabled: true, lastSyncedAt: pushResult.value, lastError: null } });
    } else {
      await updateSettings.mutateAsync({ sync: { enabled: true, lastSyncedAt: null, lastError: pushResult.error.message } });
    }
  }

  const settings = settingsQuery.data;
  const syncLabel = Platform.OS === 'ios' ? S45_COPY.iCloudSyncLabel : S45_COPY.androidSyncLabel;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <SettingsHeader title={S45_COPY.title} onBack={handleBack} />
      <View style={styles.content}>
        <Card accessibilityLabel={`${S45_COPY.noLoginHeadline} ${S45_COPY.noLoginBody}`}>
          <ShieldCheck size={20} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={[styles.cardHeadline, { color: t.color.text }]}>{S45_COPY.noLoginHeadline}</Text>
          <Text style={[styles.cardBody, { color: t.color.textMuted }]}>{S45_COPY.noLoginBody}</Text>
        </Card>

        <Card accessibilityLabel="Storage">
          <View style={styles.row} accessibilityRole="text" accessibilityLabel={S45_COPY.onDeviceLabel}>
            <Lock size={18} color={t.color.textDim} accessibilityElementsHidden importantForAccessibility="no" />
            <Text style={[styles.rowLabel, { color: t.color.text }]}>{S45_COPY.onDeviceLabel}</Text>
          </View>

          {settingsQuery.isLoading ? (
            <Skeleton width="100%" height={28} />
          ) : (
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: t.color.text }]}>{syncLabel}</Text>
              <Switch
                value={!!settings?.sync.enabled}
                onValueChange={handleToggle}
                disabled={syncing}
                accessibilityLabel={`${syncLabel}, ${settings?.sync.enabled ? 'on' : 'off'}`}
              />
            </View>
          )}

          {settings?.sync.enabled ? (
            settings.sync.lastError ? (
              <InlineRetryBanner message={S45_COPY.failure} onRetry={handleRetry} tone="warning" />
            ) : (
              <Text style={[styles.helper, { color: t.color.textMuted }]}>
                {settings.sync.lastSyncedAt ? `${S45_COPY.lastSyncedPrefix} ${formatRelative(settings.sync.lastSyncedAt)}` : S45_COPY.lastSyncedPrefix}
              </Text>
            )
          ) : (
            <Text style={[styles.helper, { color: t.color.textMuted }]}>{S45_COPY.offHelper}</Text>
          )}
        </Card>
      </View>
    </View>
  );
}

function formatRelative(iso: string): string {
  const deltaMs = Date.parse(now()) - Date.parse(iso);
  const minutes = Math.max(0, Math.round(deltaMs / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  cardHeadline: { fontSize: 16, fontWeight: '600' },
  cardBody: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2 },
  rowLabel: { fontSize: 16 },
  helper: { fontSize: 14, lineHeight: 20 },
});
