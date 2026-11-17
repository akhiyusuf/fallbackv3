/** Add menu — the "What do you want to add?" sheet, opened from any add button (D3). */
import { create } from 'zustand';

export interface AddMenuStoreState {
  readonly open: boolean;
  show(): void;
  hide(): void;
}

export const useAddMenuStore = create<AddMenuStoreState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
