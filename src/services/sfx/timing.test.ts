import { REWARD_GAP_MS, resetSoundTiming, schedule, SOUND_MS } from './timing';

describe('sound timing (a reward waits for the sound of the press that earned it)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-17T12:00:00Z'));
    resetSoundTiming();
  });
  afterEach(() => jest.useRealTimers());

  it('a press sound starts at once', () => {
    const begin = jest.fn();
    schedule('tap', 0, begin);
    expect(begin).toHaveBeenCalledTimes(1);
  });

  it('a badge asked for while the done sound plays waits for it to end, then a breath longer', () => {
    const done = jest.fn();
    const badge = jest.fn();
    schedule('log_ideal', 0, done);
    schedule('badge_earned', 300, badge);
    expect(done).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(SOUND_MS.log_ideal! + REWARD_GAP_MS - 1);
    expect(badge).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(badge).toHaveBeenCalledTimes(1);
  });

  it('with nothing sounding, a reward only waits its own delay', () => {
    const badge = jest.fn();
    schedule('badge_earned', 300, badge);
    jest.advanceTimersByTime(299);
    expect(badge).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(badge).toHaveBeenCalledTimes(1);
  });

  it('two rewards never overlap: the second starts after the first has finished', () => {
    const level = jest.fn();
    const badge = jest.fn();
    schedule('level_up', 0, level);
    schedule('badge_earned', 0, badge);
    expect(level).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(SOUND_MS.level_up! + REWARD_GAP_MS - 1);
    expect(badge).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(badge).toHaveBeenCalledTimes(1);
  });

  it('a press made while a reward is waiting pushes the reward back again', () => {
    const badge = jest.fn();
    schedule('log_ideal', 0, jest.fn());
    schedule('badge_earned', 0, badge);
    jest.advanceTimersByTime(SOUND_MS.log_ideal! + REWARD_GAP_MS - 100);
    schedule('log_fallback', 0, jest.fn());
    jest.advanceTimersByTime(100);
    expect(badge).not.toHaveBeenCalled();
    jest.advanceTimersByTime(SOUND_MS.log_fallback! + REWARD_GAP_MS);
    expect(badge).toHaveBeenCalledTimes(1);
  });

  it('a reward that is called off before it starts never starts', () => {
    const badge = jest.fn();
    schedule('log_ideal', 0, jest.fn());
    const callOff = schedule('badge_earned', 0, badge);
    callOff();
    jest.advanceTimersByTime(10_000);
    expect(badge).not.toHaveBeenCalled();
  });

  it('every bundled sound has a measured length', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SOUND_FILES } = require('./sounds') as { SOUND_FILES: Record<string, number> };
    expect(Object.keys(SOUND_MS).sort()).toEqual(Object.keys(SOUND_FILES).sort());
  });
});
