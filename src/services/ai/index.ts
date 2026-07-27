/**
 * M6. F16/F18 assistant providers. `getAssistantProvider()` is the ONE sanctioned seam
 * where the app decides managed vs. BYO — every screen component consumes the returned
 * `AssistantProvider` port and never branches on `.id` beyond a purely cosmetic label
 * (docs/MODULES.md non-negotiable: "no screen knows which path it is on").
 */
import Constants from 'expo-constants';

import type { AssistantProvider, Id } from '@/types';

import { hasByoConfig } from './secureKeyStore';
import { createByoAssistantProvider } from './byoProvider';
import { createManagedAssistantProvider } from './managedProvider';
import { billing } from '@/services/billing';

export { GUARDRAIL_SYSTEM_PROMPT, GUARDRAIL_FIXTURES, classifyGuardrail } from './guardrails';
export type { GuardrailCategory, GuardrailScreenResult } from './guardrails';
export { getByoConfig, setByoConfig, clearByoConfig, hasByoConfig, describeByoConfig } from './secureKeyStore';
export type { ByoConfig } from './secureKeyStore';
export { probeByoEndpoint } from './byoProbe';
export type { ByoProbeResult } from './byoProbe';
export * from './conversationStore';

const managedProvider = createManagedAssistantProvider({
  currentReceipt: () => billing.currentReceipt(),
  clientVersion: `fallback/${Constants.expoConfig?.version ?? '1.0.0'} (${Constants.platform?.ios ? 'ios' : 'android'})`,
  taskContext: async () => {
    // Lazily imported to avoid a load-time cycle with `@/queries` (which itself may import
    // services). Names + ids only, per docs/API.md §4 — never habit data.
    const { repos } = await import('@/db');
    const tasks = await repos.tasks.list();
    return tasks.map((t) => ({ id: t.id as Id, name: t.name, type: t.type }));
  },
});

const byoProvider = createByoAssistantProvider();

/**
 * Selection rule (F17/F18): a validated BYO key, if present, is used in preference to the
 * managed subscription — it is the user's own explicit choice on S40, and works with no
 * subscription at all. Falls back to managed when entitled; otherwise the caller (S31) never
 * calls this without first routing through the paywall.
 */
export async function getAssistantProvider(): Promise<AssistantProvider> {
  if (await hasByoConfig()) return byoProvider;
  return managedProvider;
}
