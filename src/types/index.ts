/**
 * Fallback — shared type surface. Owned by M0. Frozen after M0 ships.
 * Every other module imports from '@/types' and never redeclares these.
 * Normative prose: docs/SCHEMA.md. Service contracts: docs/API.md.
 */

export * from './primitives';
export * from './task';
export * from './log';
export * from './consistency';
export * from './progress';
export * from './settings';
export * from './assistant';
export * from './ports';
