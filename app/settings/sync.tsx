/** S45 — Account and sync. */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Cloud, Smartphone } from 'lucide-react-native';
import { Platform } from 'react-native';

import { now } from '@/lib/date';
import { getSyncProvider } from '@/services/sync';
import { S45_COPY } from '@/features/data/copy';
import { useSettings, useUpdateSettings } from '@/queries';
import { InlineRetryBanner, ListGroup, ListRow, Screen, Skeleton, Switch } from '@/ui';

export default function S45AccountAndSync() {
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const [syncing, setSyncing] = useState(false);

  function handleBack() {
    router.replace('/settings' as Href);
  }

  async function push() {
    setSyncing(true);
    const pushResult = await getSyncProvider().push();
    setSyncing(false);
    if (pushResult.ok) {
      await updateSettings.mutateAsync({ sync: { enabled: true, lastSyncedAt: pushResult.value, lastError: null } });
    } else {
      await updateSettings.mutateAsync({ sync: { enabled: true, lastSyncedAt: null, lastError: pushResult.error.message } });
    }
  }

  async function handleToggle(next: boolean) {
    const patchResult = await updateSettings.mutateAsync({ sync: { enabled: next, lastSyncedAt: null, lastError: null } });
    if (!patchResult.ok || !next) return;
    await push();
  }

  const settings = settingsQuery.data;
  const syncLabel = Platform.OS === 'ios' ? S45_COPY.iCloudSyncLabel : S45_COPY.androidSyncLabel;
  const syncSub = !settings?.sync.enabled
    ? S45_COPY.offHelper
    : syncing
      ? 'Syncing…'
      : settings.sync.lastSyncedAt
        ? `${S45_COPY.lastSyncedPrefix} ${formatRelative(settings.sync.lastSyncedAt)}`
        : undefined;

  return (
    <Screen title="Account and sync" onBack={handleBack}>
      {settingsQuery.isLoading ? (
        <Skeleton height={130} radius={16} />
      ) : (
        <ListGroup title="Where your data lives" footer={`${S45_COPY.noLoginHeadline} ${S45_COPY.noLoginBody}`}>
          <ListRow icon={Smartphone} label="On this device" value="Always" />
          <ListRow
            icon={Cloud}
            label={syncLabel}
            sublabel={syncSub}
            right={
              <Switch
                value={!!settings?.sync.enabled}
                onValueChange={(v) => void handleToggle(v)}
                disabled={syncing}
                accessibilityLabel={`${syncLabel}, ${settings?.sync.enabled ? 'on' : 'off'}`}
              />
            }
          />
        </ListGroup>
      )}
      {settings?.sync.enabled && settings.sync.lastError ? <InlineRetryBanner message={S45_COPY.failure} onRetry={push} tone="warning" /> : null}
    </Screen>
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
