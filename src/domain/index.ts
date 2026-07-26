/**
 * M2. The pure domain engine — no React, no SQL, no I/O, no `new Date()`.
 * Every function is deterministic given its arguments, which is what makes the
 * PRD's worked examples runnable as golden tests.
 */
export * from './occurrence';
export * from './dayState';
export * from './consistency';
export * from './xp';
export * from './achievements';
export * from './cycles';
export * from './validation';
