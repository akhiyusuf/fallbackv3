jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

import { AGENT_SCOPES, useAgentAccessStore } from './store';

type StoreModule = typeof import('./store');
type SecureMock = { getItemAsync: jest.Mock; setItemAsync: jest.Mock };

/** Loads a fresh copy of the store, as a cold start does, with `saved` already in SecureStore. */
function loadAfterRestart(saved: string | null): { mod: StoreModule; secure: SecureMock } {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const secure = require('expo-secure-store') as SecureMock;
  secure.getItemAsync.mockResolvedValue(saved);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./store') as StoreModule;
  return { mod, secure };
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const initial = () => useAgentAccessStore.getState();

describe('agent access store (preview state)', () => {
  beforeEach(() => {
    useAgentAccessStore.setState({ enabled: false, agents: [] });
  });

  it('starts off, with no agents connected', () => {
    expect(initial().enabled).toBe(false);
    expect(initial().agents).toEqual([]);
  });

  it('connectExample adds one example agent, and calling it again does not duplicate it', () => {
    initial().connectExample();
    initial().connectExample();
    expect(initial().agents).toEqual([{ id: 'example', name: 'Claude' }]);
  });

  it('disconnect removes only the named agent', () => {
    useAgentAccessStore.setState({ agents: [{ id: 'a', name: 'Claude' }, { id: 'b', name: 'ChatGPT' }] });
    initial().disconnect('a');
    expect(initial().agents).toEqual([{ id: 'b', name: 'ChatGPT' }]);
  });

  it('disconnectAll removes every agent', () => {
    useAgentAccessStore.setState({ agents: [{ id: 'a', name: 'Claude' }, { id: 'b', name: 'ChatGPT' }] });
    initial().disconnectAll();
    expect(initial().agents).toEqual([]);
  });

  it('switching agent access off also disconnects every agent', () => {
    initial().setEnabled(true);
    initial().connectExample();
    initial().setEnabled(false);
    expect(initial().enabled).toBe(false);
    expect(initial().agents).toEqual([]);
  });

  it('deleting can never be pre-approved: its choices exclude "allow"', () => {
    const del = AGENT_SCOPES.find((s) => s.key === 'delete');
    expect(del?.choices).not.toContain('allow');
  });

  it('every scope starts at its specified permission', () => {
    for (const scope of AGENT_SCOPES) {
      expect(initial().permissions[scope.key]).toBe(scope.initial);
    }
  });
});

describe('agent access choices survive a restart', () => {
  beforeEach(() => {
    useAgentAccessStore.setState({ enabled: false, agents: [] });
  });

  it('the on/off switch and each permission are read back after a restart', async () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const secure = require('expo-secure-store') as SecureMock;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const before = require('./store') as StoreModule;
    before.useAgentAccessStore.getState().setEnabled(true);
    before.useAgentAccessStore.getState().setPermission('write', 'allow');
    before.useAgentAccessStore.getState().setPermission('delete', 'off');
    const lastSaved = secure.setItemAsync.mock.calls.at(-1)?.[1] as string;
    expect(secure.setItemAsync.mock.calls.at(-1)?.[0]).toBe('fallback.agentAccess');

    const { mod } = loadAfterRestart(lastSaved);
    await flushPromises();
    const state = mod.useAgentAccessStore.getState();
    expect(state.enabled).toBe(true);
    expect(state.permissions.write).toBe('allow');
    expect(state.permissions.delete).toBe('off');
    expect(state.permissions.log).toBe('ask');
    expect(state.agents).toEqual([]);
  });

  it('with nothing saved, the start-up defaults apply (off, and the scope defaults)', async () => {
    const { mod } = loadAfterRestart(null);
    await flushPromises();
    expect(mod.useAgentAccessStore.getState().enabled).toBe(false);
    expect(mod.useAgentAccessStore.getState().permissions.notes).toBe('off');
  });

  it('a saved value the screen does not offer for that scope is ignored', async () => {
    const saved = JSON.stringify({ enabled: true, permissions: { delete: 'allow', read: 'off' } });
    const { mod } = loadAfterRestart(saved);
    await flushPromises();
    expect(mod.useAgentAccessStore.getState().permissions.delete).toBe('ask');
    expect(mod.useAgentAccessStore.getState().permissions.read).toBe('off');
  });

  it('a damaged saved value leaves the defaults and throws nothing', async () => {
    const { mod } = loadAfterRestart('{not json');
    await flushPromises();
    expect(mod.useAgentAccessStore.getState().enabled).toBe(false);
  });

  it('a failed write keeps the choice for this run and throws nothing', async () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const secure = require('expo-secure-store') as SecureMock;
    secure.setItemAsync.mockRejectedValueOnce(new Error('keychain locked'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./store') as StoreModule;
    expect(() => mod.useAgentAccessStore.getState().setEnabled(true)).not.toThrow();
    await flushPromises();
    expect(mod.useAgentAccessStore.getState().enabled).toBe(true);
  });
});
