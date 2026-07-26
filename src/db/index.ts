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

// CR-1 (docs/MODULES.md top matter): `cycleState` is now a first-class `Repositories`
// member (`src/types/ports.ts`), landed by M0 — `repos` satisfies `Repositories` plainly,
// no intersection type needed.
export const repos: Repositories = {
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
