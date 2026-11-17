/** S48 — erase-all confirmation as the shared bottom sheet (D3). */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';

import { eraseAllData } from '@/services/data';
import { ConfirmSheet, InlineRetryBanner } from '@/ui';

import { S48_COPY } from './copy';

export function EraseDataSheet({ visible, onClose, fromRecovery = false }: { readonly visible: boolean; readonly onClose: () => void; readonly fromRecovery?: boolean }) {
  const router = useRouter();
  const [erasing, setErasing] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleErase() {
    setErasing(true);
    setFailed(false);
    const result = await eraseAllData();
    if (result.ok) {
      onClose();
      router.replace('/splash' as Href);
      return;
    }
    setErasing(false);
    setFailed(true);
  }

  return (
    <ConfirmSheet
      visible={visible}
      onClose={onClose}
      title={fromRecovery ? S48_COPY.headlineFromRecovery : S48_COPY.headlineFromData}
      message={fromRecovery ? S48_COPY.bodyFromRecovery : S48_COPY.bodyFromData}
      confirmLabel={S48_COPY.eraseButton}
      onConfirm={handleErase}
      danger
      loading={erasing}
      testID="erase-data-sheet"
    >
      {failed ? <InlineRetryBanner message={S48_COPY.midWipeFailure} onRetry={handleErase} tone="warning" /> : null}
    </ConfirmSheet>
  );
}
