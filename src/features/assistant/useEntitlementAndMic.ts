/** M6. S31's "entitlement + mic-permission status already resolved for this render" read. */
import { useCallback, useEffect, useState } from 'react';
import { getRecordingPermissionsAsync } from 'expo-audio';

import { useEntitlementStore } from '@/app-shell';
import { billing } from '@/services/billing';
import { hasByoConfig } from '@/services/ai';

export interface EntitlementAndMicStatus {
  readonly loading: boolean;
  readonly error: boolean;
  readonly isEntitled: boolean;
  readonly micGranted: boolean;
  readonly retry: () => void;
}

export function useEntitlementAndMic(): EntitlementAndMicStatus {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const entitlement = useEntitlementStore((s) => s.entitlement);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [, byo, micStatus] = await Promise.all([
        billing.refreshEntitlement(),
        hasByoConfig(),
        getRecordingPermissionsAsync(),
      ]);
      const current = useEntitlementStore.getState().entitlement;
      useEntitlementStore.getState().patchEntitlement({
        hasByoKey: byo,
        source: byo ? 'byo-key' : current.source,
      });
      setMicGranted(micStatus.granted);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isEntitled = entitlement.hasByoKey || entitlement.status === 'active' || entitlement.status === 'trial';

  return { loading, error, isEntitled, micGranted, retry: load };
}
