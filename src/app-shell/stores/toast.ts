/** M0. Ephemeral global toast queue, consumed by `@/ui`'s `Toast`. */
import { create } from 'zustand';

import { newId } from '@/lib/id';
import type { Id } from '@/types';

export type ToastTone = 'neutral' | 'success' | 'warning';

export interface ToastEntry {
  readonly id: Id;
  readonly message: string;
  readonly tone: ToastTone;
}

export interface ToastStoreState {
  readonly toast: ToastEntry | null;
  show(message: string, tone?: ToastTone): void;
  hide(): void;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toast: null,
  show: (message, tone = 'neutral') => set({ toast: { id: newId(), message, tone } }),
  hide: () => set({ toast: null }),
}));
