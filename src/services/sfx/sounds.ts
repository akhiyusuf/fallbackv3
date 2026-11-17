/**
 * The app's sounds as bundled files. Cut by docs/design-rebuild/sound-edit/edit.py from the takes the
 * human picked; every one is a recording of one object hitting another (no musical instruments).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export const SOUND_FILES = {
  ai_done: require('../../../assets/sfx/ai_done.wav') as number,
  ai_start: require('../../../assets/sfx/ai_start.wav') as number,
  ai_stop: require('../../../assets/sfx/ai_stop.wav') as number,
  badge_earned: require('../../../assets/sfx/badge_earned.wav') as number,
  day_complete: require('../../../assets/sfx/day_complete.wav') as number,
  error: require('../../../assets/sfx/error.wav') as number,
  level_up: require('../../../assets/sfx/level_up.wav') as number,
  log_fallback: require('../../../assets/sfx/log_fallback.wav') as number,
  log_ideal: require('../../../assets/sfx/log_ideal.wav') as number,
  log_skip: require('../../../assets/sfx/log_skip.wav') as number,
  reminder: require('../../../assets/sfx/reminder.wav') as number,
  saved: require('../../../assets/sfx/saved.wav') as number,
  snooze: require('../../../assets/sfx/snooze.wav') as number,
  step_tick: require('../../../assets/sfx/step_tick.wav') as number,
  tap: require('../../../assets/sfx/tap.wav') as number,
  todo_done: require('../../../assets/sfx/todo_done.wav') as number,
  toggle_off: require('../../../assets/sfx/toggle_off.wav') as number,
  toggle_on: require('../../../assets/sfx/toggle_on.wav') as number,
} as const;
