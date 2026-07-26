/**
 * M2. F30 per-cycle records + F31 cycle boundaries. Archive ALWAYS precedes zeroing.
 * A mid-cycle cadence change finalises the in-progress cycle immediately. STUB — M2 implements.
 */
import type { CycleCadence, CycleWindow, LocalDate } from '@/types';

export declare function currentCycleWindow(cadence: CycleCadence, date: LocalDate): CycleWindow;
export declare function nextCycleWindow(w: CycleWindow): CycleWindow;
export declare function cyclesElapsedSince(w: CycleWindow, today: LocalDate): CycleWindow[];
