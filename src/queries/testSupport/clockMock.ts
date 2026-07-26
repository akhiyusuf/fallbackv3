/**
 * M2 — the mutable clock a test file mocks `@/lib/date`'s `today`/`now` onto, while every
 * other real (date-fns backed) function in that module stays real via `jest.requireActual`.
 * `src/domain/**`'s own tests never need this (they take `today` as an explicit argument);
 * this exists only because `src/queries` is where the real clock is read.
 */
export const clock = {
  today: '2024-06-01',
  now: '2024-06-01T12:00:00.000Z',
};
