/** M0. Primitive/branded types shared app-wide. */

/** Calendar date in the DEVICE-LOCAL timezone, ISO `YYYY-MM-DD`. Never a Date object at rest. */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

/** Instant, ISO-8601 UTC with milliseconds, e.g. `2026-07-16T08:03:11.412Z`. */
export type Instant = string & { readonly __brand: 'Instant' };

/** Opaque row id. UUIDv4 string, generated client-side (expo-crypto). */
export type Id = string & { readonly __brand: 'Id' };

/** ISO weekday, Monday = 1 … Sunday = 7. Matches the design's Monday-start convention. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Result type used by every fallible service call. No throwing across module boundaries. */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type AppErrorCode =
  | 'STORE_UNAVAILABLE'
  | 'STORE_CORRUPT'
  | 'WRITE_FAILED'
  | 'READ_FAILED'
  | 'MIGRATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PERMISSION_DENIED'
  | 'NETWORK_UNAVAILABLE'
  | 'UPSTREAM_UNAVAILABLE'
  | 'ENTITLEMENT_REQUIRED'
  | 'ENTITLEMENT_EXPIRED'
  | 'RATE_LIMITED'
  | 'GUARDRAIL_REFUSED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface AppError {
  readonly code: AppErrorCode;
  /** Developer-facing. NEVER rendered. User copy comes from the screen's own copy.ts. */
  readonly message: string;
  readonly cause?: unknown;
  /** Field-level validation detail, keyed by form field name. */
  readonly fields?: Readonly<Record<string, string>>;
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
