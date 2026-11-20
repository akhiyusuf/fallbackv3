/**
 * AI agent access — DESIGN REFERENCE ONLY.
 *
 * This holds the state for the permission screen so the look can be reviewed. Nothing here
 * talks to an agent: there is no MCP server yet. The real feature (how an agent reaches the
 * app, how a request is verified, where the audit log is stored) has to be specified in the
 * PRD and designed by the architect before any of it is built.
 *
 * What the person chose on the screen (the on/off switch and each permission) is kept on the
 * device in SecureStore, so it is still there after the app is closed and opened again. No
 * schema is implied: it is one small JSON value. Connected agents are not kept: nothing
 * connects for real yet, so there is no connection to remember.
 */
import * as SecureStore from 'expo-secure-store';
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
  /** Back to the first-run defaults, in memory (an erase clears what is saved). */
  reset(): void;
}

const KEY = 'fallback.agentAccess';

const INITIAL = Object.fromEntries(AGENT_SCOPES.map((s) => [s.key, s.initial])) as Record<AgentScope, AgentPermission>;

export const useAgentAccessStore = create<AgentAccessState>((set) => ({
  enabled: false,
  permissions: INITIAL,
  agents: [],
  setEnabled: (enabled) => {
    set((s) => ({ enabled, agents: enabled ? s.agents : [] }));
    saveChoices();
  },
  setPermission: (scope, value) => {
    // Only the choices each scope offers: "Delete tasks" can never be set to Allow, whoever asks.
    const spec = AGENT_SCOPES.find((x) => x.key === scope);
    if (!spec || !spec.choices.includes(value)) return;
    set((s) => ({ permissions: { ...s.permissions, [scope]: value } }));
    saveChoices();
  },
  connectExample: () => set((s) => (s.agents.length ? s : { agents: [{ id: 'example', name: 'Claude' }] })),
  disconnect: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
  disconnectAll: () => set({ agents: [] }),
  reset: () => set({ enabled: false, permissions: INITIAL, agents: [] }),
}));

/** Writes the on/off switch and the permissions. A failed write keeps them for this run only. */
function saveChoices(): void {
  const { enabled, permissions } = useAgentAccessStore.getState();
  try {
    SecureStore.setItemAsync(KEY, JSON.stringify({ enabled, permissions })).catch(() => {
      // The choices still hold for this run of the app.
    });
  } catch {
    // No secure store here (a test run): keep the choices in memory only.
  }
}

/** Only a value the screen offers for that scope is accepted; anything else keeps the default. */
function parseChoices(raw: string | null): Partial<Pick<AgentAccessState, 'enabled' | 'permissions'>> | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { enabled?: unknown; permissions?: Record<string, unknown> };
    const permissions = { ...INITIAL };
    for (const scope of AGENT_SCOPES) {
      const value = saved.permissions?.[scope.key];
      if (typeof value === 'string' && (scope.choices as readonly string[]).includes(value)) {
        permissions[scope.key] = value as AgentPermission;
      }
    }
    return { enabled: saved.enabled === true, permissions };
  } catch {
    return null;
  }
}

// Read the saved choices once, at start-up. Until the read arrives the defaults apply (off).
try {
  SecureStore.getItemAsync(KEY)
    .then((raw) => {
      const saved = parseChoices(raw);
      if (saved) useAgentAccessStore.setState(saved);
    })
    .catch(() => undefined);
} catch {
  // No secure store here (a test run): keep the defaults.
}
