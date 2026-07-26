/**
 * M0. Process-local event bus. Breaks would-be import cycles between the domain
 * layer (M2) and the platform services that react to it (M7 notifications/widgets).
 */
import type { AppEvent } from '@/types';

type Handler<T extends AppEvent['type']> = (event: Extract<AppEvent, { type: T }>) => void;

const handlers = new Map<AppEvent['type'], Set<Handler<AppEvent['type']>>>();

export function emit(event: AppEvent): void {
  const set = handlers.get(event.type);
  if (!set) return;
  // Snapshot before iterating so a handler unsubscribing mid-emit is safe.
  for (const handler of Array.from(set)) {
    (handler as Handler<typeof event.type>)(event);
  }
}

export function on<T extends AppEvent['type']>(type: T, handler: (event: Extract<AppEvent, { type: T }>) => void): () => void {
  let set = handlers.get(type);
  if (!set) {
    set = new Set();
    handlers.set(type, set);
  }
  set.add(handler as Handler<AppEvent['type']>);
  return () => {
    set?.delete(handler as Handler<AppEvent['type']>);
  };
}
