/**
 * M0. Process-local event bus. Breaks would-be import cycles between the domain
 * layer (M2) and the platform services that react to it (M7 notifications/widgets).
 * STUB — M0 implements.
 */
import type { AppEvent } from '@/types';

export declare function emit(event: AppEvent): void;
export declare function on<T extends AppEvent['type']>(
  type: T,
  handler: (event: Extract<AppEvent, { type: T }>) => void,
): () => void;
