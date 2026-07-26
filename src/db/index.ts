/**
 * M1. The single database entry point. Everything above this line is typed by
 * `Repositories` (M0, src/types/ports.ts); nothing outside M1 writes SQL.
 * STUB — M1 implements.
 */
import type { Repositories, StoreLifecycle } from '@/types';

export declare const repos: Repositories;
export declare const store: StoreLifecycle;
