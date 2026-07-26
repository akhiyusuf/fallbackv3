/**
 * S47 — Data    route: /settings/data
 * Owner: M1. Features: F19, F25.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S47)
 */
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, type Href } from 'expo-router';
import { format } from 'date-fns';
import { Share, StyleSheet, Text, View } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';

import { withOrigin } from '@/navigation';
import { S47_COPY } from '@/features/data/copy';
import { SettingsHeader } from '@/features/data/SettingsHeader';
import { createBackup, restoreBackup } from '@/services/data';
import { QUERY_KEYS, useSettings } from '@/queries';
import { SPACE, useTheme } from '@/theme';
import { Button, Card, InlineRetryBanner, Skeleton } from '@/ui';
import { useToastStore } from '@/app-shell';

// Display-only formatting of an already-known Instant — not a "today()" business-logic
// clock read (ARCHITECTURE §7's rule governs determining THE date, not rendering a stored
// past timestamp).
function formatInstant(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
}

export default function S47Data() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  const settingsQuery = useSettings();

  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);

  function handleBack() {
    router.replace('/settings' as Href);
  }

  async function handleBackUpNow() {
    setBackingUp(true);
    const result = await createBackup();
    setBackingUp(false);
    if (!result.ok) {
      showToast(S47_COPY.backupFailureToast, 'warning');
      return;
    }
    await qc.invalidateQueries({ queryKey: QUERY_KEYS.settings });
    showToast(`${S47_COPY.backupSuccessPrefix} ${formatInstant(result.value.createdAt)}`, 'success');
    // Hand the written file to the OS share sheet so the user can actually move it off-device.
    try {
      await Share.share({ url: result.value.uri, message: result.value.uri });
    } catch {
      // Sharing is a convenience on top of a backup that already succeeded — never fail the
      // backup flow over a cancelled/unavailable share sheet.
    }
  }

  async function pickAndRestore() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'application/octet-stream', '*/*'] });
    if (picked.canceled || !picked.assets?.[0]) return;
    setRestoring(true);
    setRestoreFailed(false);
    const result = await restoreBackup(picked.assets[0].uri);
    setRestoring(false);
    if (!result.ok) {
      setRestoreFailed(true);
      return;
    }
    await qc.invalidateQueries();
    showToast(S47_COPY.restoreSuccessToast, 'success');
  }

  function handleEraseRow() {
    router.push(withOrigin('/settings/data/erase', 'data') as Href);
  }

  const settings = settingsQuery.data;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <SettingsHeader title={S47_COPY.title} onBack={handleBack} />
      <View style={styles.content}>
        <Card accessibilityLabel="Back up your data">
          <Button
            label={S47_COPY.backUpNow}
            onPress={handleBackUpNow}
            loading={backingUp}
            variant="primary"
            accessibilityLabel={S47_COPY.backUpNow}
          />
          {settingsQuery.isLoading ? (
            <Skeleton width="70%" height={16} />
          ) : (
            <Text style={[styles.subcopy, { color: t.color.textMuted }]}>
              {settings?.lastBackupAt ? `${S47_COPY.lastBackupPrefix} ${formatInstant(settings.lastBackupAt)}` : S47_COPY.noBackupYet}
            </Text>
          )}
        </Card>

        <Card accessibilityLabel="Restore from a backup file">
          <Button
            label={S47_COPY.restoreFromBackup}
            onPress={pickAndRestore}
            loading={restoring}
            variant="secondary"
            accessibilityLabel={S47_COPY.restoreFromBackup}
          />
          <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S47_COPY.restoreSubcopy}</Text>
          {restoreFailed ? (
            <View style={styles.restoreFailure}>
              <InlineRetryBanner message={S47_COPY.restoreFailure} onRetry={pickAndRestore} retryLabel={S47_COPY.tryDifferentFile} tone="warning" />
            </View>
          ) : null}
        </Card>

        <Card onPress={handleEraseRow} accessibilityLabel={`${S47_COPY.eraseRow}. ${S47_COPY.eraseSubcopy}`}>
          <Text style={[styles.eraseRow, { color: t.color.text }]}>{S47_COPY.eraseRow}</Text>
          <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S47_COPY.eraseSubcopy}</Text>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  subcopy: { fontSize: 14, lineHeight: 20 },
  eraseRow: { fontSize: 16, fontWeight: '600' },
  restoreFailure: { marginTop: SPACE.s1 },
});
