jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

type SfxModule = typeof import('./index');
type AudioMock = { createAudioPlayer: jest.Mock; setAudioModeAsync: jest.Mock };
type SecureMock = { getItemAsync: jest.Mock; setItemAsync: jest.Mock };

// One registry per test: the sfx module and the mocked libraries it imports are then the same instances the
// test inspects, and the module's start-up state (saved choice, player cache) starts clean.
let sfx: SfxModule;
let audio: AudioMock;
let secure: SecureMock;

/** `setup` runs after the mocked libraries exist and before the module loads, so it can prime SecureStore. */
function loadFresh(setup?: () => void): void {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  audio = require('expo-audio') as AudioMock;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  secure = require('expo-secure-store') as SecureMock;
  setup?.();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sfx = require('./index') as SfxModule;
}

function playerCreatedFor(callIndex = 0) {
  const created = audio.createAudioPlayer.mock.results[callIndex];
  return created?.value as { play: jest.Mock; seekTo: jest.Mock };
}

async function flushPromises() {
  // Let resolved SecureStore promises and their `.then` callbacks run.
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('sfx', () => {
  beforeEach(() => {
    loadFresh();
    secure.getItemAsync.mockResolvedValue(null);
    secure.setItemAsync.mockResolvedValue(undefined);
    audio.createAudioPlayer.mockImplementation(() => ({
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      volume: 1,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('plays nothing when sounds are off', async () => {
    sfx.useSoundStore.getState().setOn(false);

    sfx.play('tap');
    sfx.play('saved', 10);
    await new Promise((r) => setTimeout(r, 20));

    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
  });

  it('plays a bundled sound when sounds are on', () => {
    sfx.play('tap');

    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(playerCreatedFor().play).toHaveBeenCalledTimes(1);
    expect(playerCreatedFor().seekTo).toHaveBeenCalledWith(0);
  });

  it('a delayed play fires after the delay, not before', () => {
    jest.useFakeTimers();

    sfx.play('saved', 300);
    jest.advanceTimersByTime(299);
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(audio.createAudioPlayer).toHaveBeenCalled();
    expect(playerCreatedFor().play).toHaveBeenCalledTimes(1);
  });

  it('a delayed play is dropped if sounds were turned off before it fires', () => {
    jest.useFakeTimers();

    sfx.play('saved', 300);
    sfx.useSoundStore.getState().setOn(false);
    jest.advanceTimersByTime(300);

    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
  });

  it('a failure inside the audio library never throws out of play', () => {

    audio.createAudioPlayer.mockImplementation(() => {
      throw new Error('native audio unavailable');
    });
    expect(() => sfx.play('tap')).not.toThrow();

    audio.setAudioModeAsync.mockImplementationOnce(() => {
      throw new Error('mode refused');
    });
    expect(() => sfx.play('step_tick')).not.toThrow();
  });

  it('a player whose play() or seekTo() fails never throws out of play', async () => {
    audio.createAudioPlayer.mockImplementation(() => ({
      play: jest.fn(() => {
        throw new Error('boom');
      }),
      seekTo: jest.fn(() => Promise.reject(new Error('seek failed'))),
    }));

    expect(() => sfx.play('log_ideal')).not.toThrow();
    await flushPromises();
  });

  it('a rejected audio-mode request is swallowed', async () => {
    audio.setAudioModeAsync.mockImplementationOnce(() => Promise.reject(new Error('no session')));

    expect(() => sfx.play('tap')).not.toThrow();
    await flushPromises();
    expect(audio.createAudioPlayer).toHaveBeenCalled();
  });

  it('reads the saved choice once at start-up: "off" silences sounds', async () => {
    loadFresh(() => secure.getItemAsync.mockResolvedValue('off'));
    expect(secure.getItemAsync).toHaveBeenCalledWith('fallback.sounds');

    await flushPromises();
    expect(sfx.useSoundStore.getState().on).toBe(false);

    sfx.play('tap');
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
  });

  it('a saved "on" or no saved choice leaves sounds on', async () => {
    loadFresh(() => secure.getItemAsync.mockResolvedValue('on'));
    await flushPromises();
    expect(sfx.useSoundStore.getState().on).toBe(true);

    loadFresh(() => secure.getItemAsync.mockResolvedValue(null));
    await flushPromises();
    expect(sfx.useSoundStore.getState().on).toBe(true);
  });

  it('a failed read at start-up keeps the default (on) and throws nothing', async () => {
    loadFresh(() => secure.getItemAsync.mockRejectedValue(new Error('keychain locked')));
    await flushPromises();
    expect(sfx.useSoundStore.getState().on).toBe(true);
  });

  it('setOn writes the choice to SecureStore', () => {

    sfx.useSoundStore.getState().setOn(false);
    expect(sfx.useSoundStore.getState().on).toBe(false);
    expect(secure.setItemAsync).toHaveBeenLastCalledWith('fallback.sounds', 'off');

    sfx.useSoundStore.getState().setOn(true);
    expect(sfx.useSoundStore.getState().on).toBe(true);
    expect(secure.setItemAsync).toHaveBeenLastCalledWith('fallback.sounds', 'on');
  });

  it('a failed write keeps the choice for this run and does not throw', async () => {
    secure.setItemAsync.mockRejectedValue(new Error('disk full'));

    expect(() => sfx.useSoundStore.getState().setOn(false)).not.toThrow();
    await flushPromises();
    expect(sfx.useSoundStore.getState().on).toBe(false);
  });
});
