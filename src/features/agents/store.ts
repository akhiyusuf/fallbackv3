/**
 * AI agent access — DESIGN REFERENCE ONLY.
 *
 * This holds the state for the permission screen so the look can be reviewed. Nothing here
 * talks to an agent: there is no MCP server yet. The real feature (how an agent reaches the
 * app, how a request is verified, where the audit log is stored) has to be specified in the
 * PRD and designed by the architect before any of it is built. State is in memory on purpose,
 * so no schema is implied.
 */
import { create } from 'zustand';

export type AgentPermission = 'allow' | 'ask' | 'off';
export type AgentScope = 'read' | 'log' | 'write' | 'delete' | 'notes';

export interface AgentScopeSpec {
  readonly key: AgentScope;
  readonly label: string;
  /** Deleting can never be pre-approved; reading is never a per-request question. */
  readonly choices: readonly AgentPermission[];
  readonly initial: AgentPermission;
}

export const AGENT_SCOPES: readonly AgentScopeSpec[] = [
  { key: 'read', label: 'See tasks, logs and progress', choices: ['allow', 'off'], initial: 'allow' },
  { key: 'log', label: 'Log done, fallback or skip', choices: ['ask', 'allow', 'off'], initial: 'ask' },
  { key: 'write', label: 'Add and edit tasks', choices: ['ask', 'allow', 'off'], initial: 'ask' },
  { key: 'delete', label: 'Delete tasks', choices: ['ask', 'off'], initial: 'ask' },
  { key: 'notes', label: 'Read notes and to-do details', choices: ['allow', 'off'], initial: 'off' },
];

export const AGENT_PERMISSION_LABEL: Record<AgentPermission, string> = { ask: 'Ask me every time', allow: 'Allow', off: "Don't allow" };

export interface ConnectedAgent {
  readonly id: string;
  readonly name: string;
}

export interface AgentAccessState {
  readonly enabled: boolean;
  readonly permissions: Record<AgentScope, AgentPermission>;
  readonly agents: readonly ConnectedAgent[];
  setEnabled(enabled: boolean): void;
  setPermission(scope: AgentScope, value: AgentPermission): void;
  connectExample(): void;
  disconnect(id: string): void;
  disconnectAll(): void;
}

const INITIAL = Object.fromEntries(AGENT_SCOPES.map((s) => [s.key, s.initial])) as Record<AgentScope, AgentPermission>;

export const useAgentAccessStore = create<AgentAccessState>((set) => ({
  enabled: false,
  permissions: INITIAL,
  agents: [],
  setEnabled: (enabled) => set((s) => ({ enabled, agents: enabled ? s.agents : [] })),
  setPermission: (scope, value) => set((s) => ({ permissions: { ...s.permissions, [scope]: value } })),
  connectExample: () => set((s) => (s.agents.length ? s : { agents: [{ id: 'example', name: 'Claude' }] })),
  disconnect: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
  disconnectAll: () => set({ agents: [] }),
}));
