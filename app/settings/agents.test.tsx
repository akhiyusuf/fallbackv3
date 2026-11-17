/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';

import { useToastStore } from '@/app-shell';
import { AGENT_PERMISSION_LABEL, AGENT_SCOPES, useAgentAccessStore } from '@/features/agents/store';

import AgentAccess from './agents';

const INITIAL_PERMISSIONS = Object.fromEntries(AGENT_SCOPES.map((s) => [s.key, s.initial]));

function resetStore() {
  useAgentAccessStore.setState({ enabled: false, permissions: { ...INITIAL_PERMISSIONS } as never, agents: [] });
}

describe('AI agent access (preview)', () => {
  beforeEach(() => {
    resetStore();
    useToastStore.setState({ toast: null });
  });

  it('is off by default: no agent can connect, and no connect controls are shown', async () => {
    await render(<AgentAccess />);
    expect(screen.getByLabelText('Let AI agents connect')).toBeTruthy();
    expect(screen.getByText('Off. No agent can see or change anything.')).toBeTruthy();
    expect(screen.queryByText('Connect an agent')).toBeNull();
    expect(screen.queryByText('What an agent may do')).toBeNull();
  });

  it('shows the design-preview notice on screen', async () => {
    await render(<AgentAccess />);
    expect(screen.getByText('Design preview. Agents cannot connect yet. This screen shows how the permissions would work.')).toBeTruthy();
  });

  it('turning the switch on reveals the connect controls, and turning it off clears any connected agent', async () => {
    const user = userEvent.setup();
    await render(<AgentAccess />);
    await user.press(screen.getByLabelText('Let AI agents connect'));
    expect(useAgentAccessStore.getState().enabled).toBe(true);
    expect(screen.getByText('No agent connected')).toBeTruthy();
    expect(screen.getByText('Connect an agent')).toBeTruthy();

    useAgentAccessStore.setState({ agents: [{ id: 'example', name: 'Claude' }] });
    await user.press(screen.getByLabelText('Let AI agents connect'));
    expect(useAgentAccessStore.getState().enabled).toBe(false);
    expect(useAgentAccessStore.getState().agents).toEqual([]);
  });

  it('connect path: "Connect an agent" shows the one-time code, and the preview connects an example agent', async () => {
    const user = userEvent.setup();
    useAgentAccessStore.setState({ enabled: true });
    await render(<AgentAccess />);
    await user.press(screen.getByText('Connect an agent'));
    expect(screen.getByText('4K7 92Q')).toBeTruthy();
    expect(screen.getByText('The code works once and expires in 10 minutes.')).toBeTruthy();

    await user.press(screen.getByText('Preview: show a connected agent'));
    expect(useAgentAccessStore.getState().agents).toEqual([{ id: 'example', name: 'Claude' }]);
    expect(screen.getByText('Claude')).toBeTruthy();
    expect(screen.queryByText('4K7 92Q')).toBeNull();
  });

  it('"Done" on the connect sheet closes it without connecting anyone', async () => {
    const user = userEvent.setup();
    useAgentAccessStore.setState({ enabled: true });
    await render(<AgentAccess />);
    await user.press(screen.getByText('Connect an agent'));
    await user.press(screen.getByText('Done'));
    expect(useAgentAccessStore.getState().agents).toEqual([]);
    expect(screen.getByText('No agent connected')).toBeTruthy();
    expect(screen.queryByText('4K7 92Q')).toBeNull();
  });

  it('disconnect path: "Disconnect" removes that agent and the list falls back to "No agent connected"', async () => {
    const user = userEvent.setup();
    useAgentAccessStore.setState({ enabled: true, agents: [{ id: 'example', name: 'Claude' }] });
    await render(<AgentAccess />);
    await user.press(screen.getByLabelText('Disconnect Claude'));
    expect(useAgentAccessStore.getState().agents).toEqual([]);
    expect(screen.getByText('No agent connected')).toBeTruthy();
  });

  it('"Disconnect every agent" removes all agents and confirms with a success toast', async () => {
    const user = userEvent.setup();
    useAgentAccessStore.setState({ enabled: true, agents: [{ id: 'a', name: 'Claude' }, { id: 'b', name: 'ChatGPT' }] });
    await render(<AgentAccess />);
    await user.press(screen.getByText('Disconnect every agent'));
    expect(useAgentAccessStore.getState().agents).toEqual([]);
    expect(useToastStore.getState().toast?.message).toBe('All agents disconnected');
    expect(useToastStore.getState().toast?.tone).toBe('success');
  });

  it('"Disconnect every agent" is hidden when no agent is connected', async () => {
    useAgentAccessStore.setState({ enabled: true, agents: [] });
    await render(<AgentAccess />);
    expect(screen.queryByText('Disconnect every agent')).toBeNull();
  });

  it('permission choices update the store; deleting can never be allowed in advance', async () => {
    const user = userEvent.setup();
    useAgentAccessStore.setState({ enabled: true });
    await render(<AgentAccess />);
    expect(screen.getByLabelText(`Add and edit tasks, ${AGENT_PERMISSION_LABEL.ask}`)).toBeTruthy();

    await user.press(screen.getByLabelText(`Add and edit tasks, ${AGENT_PERMISSION_LABEL.ask}`));
    await user.press(screen.getByLabelText(AGENT_PERMISSION_LABEL.allow));
    expect(useAgentAccessStore.getState().permissions.write).toBe('allow');

    await user.press(screen.getByLabelText(`Delete tasks, ${AGENT_PERMISSION_LABEL.ask}`));
    expect(screen.queryByLabelText(AGENT_PERMISSION_LABEL.allow)).toBeNull();
    expect(screen.getByLabelText(AGENT_PERMISSION_LABEL.off)).toBeTruthy();
  });

  it('a request example can be allowed "always", which sets the add-and-edit permission to allow', async () => {
    const user = userEvent.setup();
    useAgentAccessStore.setState({ enabled: true });
    await render(<AgentAccess />);
    await user.press(screen.getByText('See an example request'));
    await user.press(screen.getByText('Always allow adding tasks'));
    expect(useAgentAccessStore.getState().permissions.write).toBe('allow');
  });
});
