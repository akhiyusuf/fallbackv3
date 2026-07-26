/**
 * M0. Process-local event bus. Breaks would-be import cycles between the domain
 * layer (M2) and the platform services that react to it (M7 notifications/widgets).
 *
 * Per-handler isolation is a property of the bus itself, not of any one producer's call
 * site — M1's `safeEmit` wraps its own `emit()` calls, which protects M1's `Result`s but
 * does nothing for the *other* subscribers of the same event, and nothing for M2's raw
 * `emit()` sites. A throwing subscriber must never starve a later subscriber of the same
 * event, and must never propagate out through `emit()` into the caller.
 */
import type { AppEvent } from '@/types';

type Handler<T extends AppEvent['type']> = (event: Extract<AppEvent, { type: T }>) => void;

const handlers = new Map<AppEvent['type'], Set<Handler<AppEvent['type']>>>();

export function emit(event: AppEvent): void {
  const set = handlers.get(event.type);
  if (!set) return;
  // Snapshot before iterating so a handler unsubscribing mid-emit is safe.
  for (const handler of Array.from(set)) {
    try {
      (handler as Handler<typeof event.type>)(event);
    } catch (error) {
      // Dev-only signal (never telemetry, never shipped in production): a subscriber bug
      // should name itself loudly instead of silently starving every later subscriber of
      // this same event (e.g. an M7 widget handler throwing on `store:ready` would
      // otherwise just leave the widget quietly stale, with no crash and no message).
      if (__DEV__) {
        console.error(`[events] subscriber to "${event.type}" threw and was isolated:`, error);
      }
    }
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
