/**
 * When a sound may start. Most sounds answer a press and start at once. A reward (a badge, a new
 * level, the day finished) is different: it must not land on top of the sound of the press that
 * earned it. So a reward waits until whatever is sounding has finished, then a short breath
 * longer, and two rewards never overlap each other.
 *
 * No audio here: the caller passes `begin`, which starts the sound (and anything shown with it).
 * Shared by the app's sound engine and the browser preview's, so their timing cannot drift apart.
 */

/** How long each sound lasts, in milliseconds (measured from the files in assets/sfx). */
export const SOUND_MS: Readonly<Record<string, number>> = {
  ai_done: 1300,
  ai_start: 600,
  ai_stop: 700,
  badge_earned: 2000,
  day_complete: 1900,
  error: 500,
  level_up: 2300,
  log_fallback: 850,
  log_ideal: 1150,
  log_skip: 430,
  reminder: 1600,
  saved: 220,
  snooze: 400,
  step_tick: 240,
  tap: 135,
  todo_done: 620,
  toggle_off: 260,
  toggle_on: 220,
};

const REWARDS: ReadonlySet<string> = new Set(['badge_earned', 'level_up', 'day_complete']);

/** The quiet left between the end of one sound and the start of a reward. */
export const REWARD_GAP_MS = 500;

let soundingUntil = 0;
interface Waiting {
  readonly name: string;
  readonly begin: () => void;
}
let waiting: Waiting[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function mark(name: string): void {
  soundingUntil = Math.max(soundingUntil, Date.now() + (SOUND_MS[name] ?? 0));
}

function pump(): void {
  timer = null;
  const next = waiting[0];
  if (!next) return;
  const wait = soundingUntil + REWARD_GAP_MS - Date.now();
  if (wait > 0) {
    timer = setTimeout(pump, wait);
    return;
  }
  waiting = waiting.slice(1);
  mark(next.name);
  next.begin();
  if (waiting.length > 0) timer = setTimeout(pump, soundingUntil + REWARD_GAP_MS - Date.now());
}

/**
 * Calls `begin` when `name` may start: after `delayMs`, and for a reward, not before the sounds
 * already playing have finished. Returns a function that calls it off if it has not begun.
 */
export function schedule(name: string, delayMs: number, begin: () => void): () => void {
  let called = false;
  let off = false;
  const entry: Waiting = {
    name,
    begin: () => {
      called = true;
      begin();
    },
  };
  const go = () => {
    if (off) return;
    if (!REWARDS.has(name)) {
      mark(name);
      entry.begin();
      return;
    }
    waiting = [...waiting, entry];
    if (!timer) pump();
  };
  const delay = delayMs > 0 ? setTimeout(go, delayMs) : null;
  if (!delay) go();
  return () => {
    if (called) return;
    off = true;
    if (delay) clearTimeout(delay);
    waiting = waiting.filter((w) => w !== entry);
  };
}

/** For tests: forget what is sounding and what is waiting. */
export function resetSoundTiming(): void {
  soundingUntil = 0;
  waiting = [];
  if (timer) clearTimeout(timer);
  timer = null;
}
