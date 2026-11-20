/**
 * One write at a time. Every write that reconciles XP, badges or cycles reads the totals before and
 * after its own change to say what IT earned (the "+10 XP" toast, the level-up, the badge). Two such
 * writes running at the same moment (two screens, a double tap, the launch repair beside the first
 * log) each read the totals around the other's change: both report the same award, the level-up and
 * badge notifications fire twice, and a second Push to tomorrow can pass its checks before the first
 * one is written. Running them one after another, in the order they were asked, removes the race.
 *
 * A failure in one never blocks the next. Never call a serialized function from inside another one
 * (it would wait for itself): inner steps call the unwrapped helpers.
 */
let tail: Promise<unknown> = Promise.resolve();

/**
 * A write that never settles (a hung native call) must not freeze every save after it: once a
 * write has run this long, the next one may start. The stalled one is not cancelled; it still
 * finishes (or not) on its own.
 */
export const STALL_MS = 10_000;

export function serialWrite<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return (...args: A) => {
    const previous = tail;
    const run = previous.then(() => fn(...args));
    tail = previous.then(
      () =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, STALL_MS);
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          run.then(done, done);
        }),
    );
    return run;
  };
}
