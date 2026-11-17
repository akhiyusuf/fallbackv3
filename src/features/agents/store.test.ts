import { AGENT_SCOPES, useAgentAccessStore } from './store';

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
