/**
 * Sounds. One call: `play('log_ideal')`. Every sound is cut from a recording of one object
 * hitting another (no musical instruments), levelled as a set: frequent sounds are quiet and
 * dry, rare happy ones are louder and carry a short echo.
 *
 * Played with `expo-audio` from bundled files. The on/off choice ("Sounds" in Settings) is kept
 * on the device. Sounds mix with whatever the person is already playing and never take over the
 * audio session; on an iPhone the silent switch silences them.
 *
 * Nothing here may ever break the action that asked for a sound: every native call is guarded.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { SOUND_FILES } from './sounds';
import { schedule } from './timing';

export type SoundName = keyof typeof SOUND_FILES;

const KEY = 'fallback.sounds';

interface SoundState {
  readonly on: boolean;
  setOn(on: boolean): void;
}
export const useSoundStore = create<SoundState>((set) => ({
  on: true,
  setOn: (on) => {
    set({ on });
    SecureStore.setItemAsync(KEY, on ? 'on' : 'off').catch(() => {
      // The choice still holds for this run of the app.
    });
  },
}));

// Read the saved choice once, at start-up. Until it arrives sounds are on (the default).
try {
  SecureStore.getItemAsync(KEY)
    .then((saved) => {
      if (saved === 'off') useSoundStore.setState({ on: false });
    })
    .catch(() => undefined);
} catch {
  // No secure store here (a test run): keep the default.
}

const players = new Map<SoundName, AudioPlayer | null>();
let modeAsked = false;

function playerFor(name: SoundName): AudioPlayer | null {
  if (players.has(name)) return players.get(name) ?? null;
  let player: AudioPlayer | null = null;
  try {
    if (!modeAsked) {
      modeAsked = true;
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
    }
    player = createAudioPlayer(SOUND_FILES[name]);
  } catch {
    player = null;
  }
  players.set(name, player);
  return player;
}

// The sounds heard most are made ready the first time any sound plays, so they start on the press.
const FREQUENT: readonly SoundName[] = ['tap', 'step_tick', 'log_ideal', 'log_fallback', 'log_skip', 'saved'];
let warmed = false;

function start(name: SoundName): void {
  if (!useSoundStore.getState().on) return;
  try {
    const player = playerFor(name);
    if (!player) return;
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // A sound that cannot play is simply not heard.
  }
  if (!warmed) {
    warmed = true;
    setTimeout(() => FREQUENT.forEach((n) => playerFor(n)), 0);
  }
}

const NOTHING = (): void => undefined;

/**
 * Play a sound now, or after `delayMs`. A reward (badge, level, day finished) also waits for the
 * sounds already playing to end (see `timing.ts`). `onStart` runs at the moment the sound starts,
 * so a pop-up can arrive together with its sound; it still runs when sounds are switched off.
 * Returns a function that calls the sound off if it has not started yet.
 */
export function play(name: SoundName, delayMs = 0, onStart?: () => void): () => void {
  if (!useSoundStore.getState().on) {
    if (!onStart) return NOTHING;
    const timer = setTimeout(onStart, delayMs);
    return () => clearTimeout(timer);
  }
  return schedule(name, delayMs, () => {
    start(name);
    onStart?.();
  });
}
