/**
 * M0. Mirrors the store/BYO entitlement (F17/F18) so the S31/S38 paywall gate is
 * synchronous. M6's billing service is the sole writer at runtime.
 */
import { create } from 'zustand';

import type { EntitlementState } from '@/types';

const DEFAULT_ENTITLEMENT: EntitlementState = {
  source: 'none',
  plan: null,
  status: 'none',
  renewsOn: null,
  trialEndsOn: null,
  hasByoKey: false,
  byoSupportsTranscription: false,
};

export interface EntitlementStoreState {
  readonly entitlement: EntitlementState;
  setEntitlement(entitlement: EntitlementState): void;
  patchEntitlement(patch: Partial<EntitlementState>): void;
}

export const useEntitlementStore = create<EntitlementStoreState>((set, get) => ({
  entitlement: DEFAULT_ENTITLEMENT,
  setEntitlement: (entitlement) => set({ entitlement }),
  patchEntitlement: (patch) => set({ entitlement: { ...get().entitlement, ...patch } }),
}));
