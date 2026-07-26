/** M0. UUIDv4 generation (expo-crypto). */
import * as Crypto from 'expo-crypto';

import type { Id } from '@/types';

export function newId(): Id {
  return Crypto.randomUUID() as Id;
}
