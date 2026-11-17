import { play } from '@/services/sfx';
import { create } from 'zustand';

import { newId } from '@/lib/id';
import type { Id } from '@/types';

export type ToastTone = 'neutral' | 'success' | 'warning';
/** Which state icon leads the toast (D2). `null` = plain message. */
export type ToastIcon = 'ideal' | 'fallback' | 'skip' | null;

export interface ToastAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface ToastOptions {
  readonly icon?: ToastIcon;
  /** Trailing muted detail, e.g. "+10 XP". */
  readonly detail?: string;
  readonly action?: ToastAction;
}

export interface ToastEntry {
  readonly id: Id;
  readonly message: string;
  readonly tone: ToastTone;
  readonly icon: ToastIcon;
  readonly detail?: string;
  readonly action?: ToastAction;
}

export interface ToastStoreState {
  readonly toast: ToastEntry | null;
  /** Number of mounted pinned action bars; the toast lifts above them. */
  readonly actionBars: number;
  show(message: string, tone?: ToastTone, options?: ToastOptions): void;
  hide(): void;
  registerActionBar(): () => void;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toast: null,
  actionBars: 0,
  show: (message, tone = 'neutral', options) => {
    // Every "could not do that" message arrives here, so its sound lives here too. A plain green
    // message means something was saved or went through; log messages carry an icon and their own sound.
    if (tone === 'warning') play('error');
    else if (tone === 'success' && !options?.icon) play('saved');
    set({ toast: { id: newId(), message, tone, icon: options?.icon ?? null, detail: options?.detail, action: options?.action } });
  },
  hide: () => set({ toast: null }),
  registerActionBar: () => {
    set((s) => ({ actionBars: s.actionBars + 1 }));
    return () => set((s) => ({ actionBars: Math.max(0, s.actionBars - 1) }));
  },
}));
