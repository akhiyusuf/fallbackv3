/**
 * The Skip sheet's one open request. Pressing "Skip today" anywhere asks here instead of logging
 * a skip straight away; `SkipSheetHost` (mounted once in app/_layout.tsx) shows the choice.
 */
import { create } from 'zustand';

import type { Id, LocalDate } from '@/types';

export interface SkipRequest {
  readonly taskId: Id;
  readonly name: string;
  readonly date: LocalDate;
  /** Logs the plain skip (a miss), with the caller's own sound, toast and undo. */
  readonly onSkip: () => void;
}

interface SkipSheetState {
  readonly request: SkipRequest | null;
  ask(request: SkipRequest): void;
  close(): void;
}

export const useSkipSheetStore = create<SkipSheetState>((set) => ({
  request: null,
  ask: (request) => set({ request }),
  close: () => set({ request: null }),
}));
