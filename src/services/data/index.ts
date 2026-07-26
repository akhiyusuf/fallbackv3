/** M1. F19 backup/restore + F25 erase-all. STUB — M1 implements. */
import type { Instant, Result } from '@/types';

export declare function createBackup(): Promise<Result<{ uri: string; createdAt: Instant }>>;
export declare function restoreBackup(uri: string): Promise<Result<void>>;
/** F25: atomic. Fully erased or fully intact — never half-wiped. */
export declare function eraseAllData(): Promise<Result<void>>;
