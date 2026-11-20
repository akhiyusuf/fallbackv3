/** S48 — erase-all confirmation as the shared bottom sheet (D3). */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';

import { useEntitlementStore } from '@/app-shell';
import { useAgentAccessStore } from '@/features/agents/store';
import { eraseAllData } from '@/services/data';
import { useSoundStore } from '@/services/sfx';
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
      // What the app holds in memory goes back to first-run defaults with the data, so nothing
      // from before the erase shows until the next launch.
      useSoundStore.setState({ on: true });
      useAgentAccessStore.getState().reset();
      // The BYO key went with the data. A store subscription is the store's, not ours, so it stays.
      const entitlement = useEntitlementStore.getState().entitlement;
      useEntitlementStore.getState().patchEntitlement({
        hasByoKey: false,
        byoSupportsTranscription: false,
        source: entitlement.source === 'byo-key' ? 'none' : entitlement.source,
      });
      onClose();
      // Start again from the splash with nothing behind it: Back must not return to the
      // screens that showed the erased data.
      try {
        router.dismissAll();
      } catch {
        // Nothing to dismiss.
      }
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
