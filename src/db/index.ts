/**
 * M1. The single database entry point. Everything above this line is typed by
 * `Repositories` (M0, src/types/ports.ts); nothing outside M1 writes SQL.
 *
 * `repos` and `store` share one `DbClientProxy` (see `client.ts`): repositories are built
 * once, at module load, against the proxy, and `store` re-points the proxy's live
 * connection on `open()` and on the close-delete-reopen inside `eraseAll()`. That is what
 * lets a feature module hold onto `repos` for the app's whole lifetime without caring that
 * the underlying SQLite connection gets recycled underneath it.
 */
import type { Repositories } from '@/types';

import { DbClientProxy } from './client';
import { createStoreLifecycle } from './lifecycle';
import { createAsNeededRepository } from './repositories/asNeededRepository';
import { createAssistantRepository } from './repositories/assistantRepository';
import { createCycleStateRepository } from './repositories/cycleStateRepository';
import { createLogRepository } from './repositories/logRepository';
import { createOffDayRepository } from './repositories/offDayRepository';
import { createProgressRepository } from './repositories/progressRepository';
import { createSettingsRepository } from './repositories/settingsRepository';
import { createTaskRepository } from './repositories/taskRepository';

const proxy = new DbClientProxy();

/**
 * `Repositories` plus `cycleState` — see `src/db/cycleWindowSeed.ts`'s header for why:
 * `ports.ts`'s `ProgressRepository` has no `cycle_state` accessor even though SCHEMA §8
 * defines it as a persisted singleton. This is additive, never a modification of the
 * frozen port shape — every consumer that only knows about `Repositories` still works.
 */
export const repos: Repositories & { readonly cycleState: ReturnType<typeof createCycleStateRepository> } = {
  tasks: createTaskRepository(proxy),
  logs: createLogRepository(proxy),
  offDays: createOffDayRepository(proxy),
  asNeeded: createAsNeededRepository(proxy),
  progress: createProgressRepository(proxy),
  settings: createSettingsRepository(proxy),
  assistant: createAssistantRepository(proxy),
  cycleState: createCycleStateRepository(proxy),
};

export const store = createStoreLifecycle(proxy);

export type { DbClient } from './client';
export { DbClientProxy } from './client';
