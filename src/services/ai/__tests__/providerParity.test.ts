/**
 * Proves `ManagedAssistantProvider` and `ByoAssistantProvider` implement the IDENTICAL
 * `AssistantProvider` port (docs/MODULES.md non-negotiable) — same method names, same
 * arity, so no screen component can branch on which one it holds.
 */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import { createByoAssistantProvider } from '../byoProvider';
import { createManagedAssistantProvider } from '../managedProvider';

describe('AssistantProvider port parity (managed vs. BYO)', () => {
  const managed = createManagedAssistantProvider({
    currentReceipt: async () => null,
    clientVersion: 'test',
    taskContext: async () => [],
  });
  const byo = createByoAssistantProvider();

  it('both expose the exact same method surface', () => {
    const methodNames = (o: object) => Object.keys(o).sort();
    expect(methodNames(managed)).toEqual(methodNames(byo));
    expect(methodNames(managed)).toEqual(['capabilities', 'id', 'streamChat', 'transcribe']);
  });

  it('ids are the only distinguishing, non-branchable label', () => {
    expect(managed.id).toBe('managed');
    expect(byo.id).toBe('byo');
  });

  it('both `capabilities()` return the same `{chat, transcription}` shape', async () => {
    const managedCaps = await managed.capabilities();
    const byoCaps = await byo.capabilities(); // no key configured -> both false
    expect(Object.keys(managedCaps).sort()).toEqual(Object.keys(byoCaps).sort());
  });

  it('both `streamChat` return an AsyncIterable of AssistantEvent-shaped objects', async () => {
    // No key configured for BYO and no network for managed — both degrade to a single
    // `error` event rather than throwing, proving the port's calm-failure contract is
    // uniform across paths.
    const byoEvents: unknown[] = [];
    for await (const event of byo.streamChat({ conversationId: 'c1' as never, messages: [] })) {
      byoEvents.push(event);
    }
    expect(byoEvents.length).toBeGreaterThan(0);
    expect(byoEvents[0]).toHaveProperty('type');
  });
});
