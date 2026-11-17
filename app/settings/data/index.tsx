/** S47 — Data. Backup and restore as list rows (D7); erase is a clear red row that opens a confirm sheet (D3). */
import { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { format } from 'date-fns';
import { DownloadCloud, Trash2, UploadCloud } from 'lucide-react-native';
import { Share } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { S47_COPY } from '@/features/data/copy';
import { EraseDataSheet } from '@/features/data/EraseDataSheet';
import { createBackup, restoreBackup } from '@/services/data';
import { QUERY_KEYS, useSettings } from '@/queries';
import { InlineRetryBanner, ListGroup, ListRow, Screen } from '@/ui';
import { useToastStore } from '@/app-shell';

function formatInstant(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy 'at' h:mm a");
}

export default function S47Data() {
  const router = useRouter();
  const qc = useQueryClient();
  const { confirmErase } = useLocalSearchParams<{ confirmErase?: string }>();
  const showToast = useToastStore((s) => s.show);
  const settingsQuery = useSettings();

  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);

  useEffect(() => {
    if (confirmErase === '1') setEraseOpen(true);
  }, [confirmErase]);

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
    try {
      await Share.share({ url: result.value.uri, message: result.value.uri });
    } catch {
      /* sharing is optional */
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

  const settings = settingsQuery.data;
  const lastBackup = settings?.lastBackupAt ? `${S47_COPY.lastBackupPrefix} ${formatInstant(settings.lastBackupAt)}` : S47_COPY.noBackupYet;

  return (
    <Screen title={S47_COPY.title} onBack={handleBack}>
      <ListGroup title="Backup">
        <ListRow
          icon={UploadCloud}
          label={backingUp ? 'Backing up…' : S47_COPY.backUpNow}
          sublabel={settingsQuery.isLoading ? undefined : lastBackup}
          onPress={() => void handleBackUpNow()}
          disabled={backingUp}
          chevron={false}
        />
        <ListRow
          icon={DownloadCloud}
          label={restoring ? 'Restoring…' : S47_COPY.restoreFromBackup}
          sublabel={S47_COPY.restoreSubcopy}
          onPress={() => void pickAndRestore()}
          disabled={restoring}
          chevron={false}
        />
      </ListGroup>
      {restoreFailed ? <InlineRetryBanner message={S47_COPY.restoreFailure} onRetry={pickAndRestore} retryLabel={S47_COPY.tryDifferentFile} tone="warning" /> : null}

      <ListGroup title="Erase">
        <ListRow icon={Trash2} label={S47_COPY.eraseRow} sublabel={S47_COPY.eraseSubcopy} danger onPress={() => setEraseOpen(true)} chevron={false} />
      </ListGroup>

      <EraseDataSheet visible={eraseOpen} onClose={() => setEraseOpen(false)} />
    </Screen>
  );
}
