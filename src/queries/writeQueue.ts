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

export function serialWrite<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return (...args: A) => {
    const run = tail.then(() => fn(...args));
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
