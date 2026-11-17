# Sound effects for the prototype

Rule from the human (2026-11-17): **no musical instruments in the app.** Sounds are things hitting things (an iron rod on an iron bar, not a bell).

Rule from the human: do not go overboard. Every sound the app plays is cut from one of six short source takes by editing (trim, level, pitch, repeats, echo where it helps).

## How they are made

- Generated with ElevenLabs Sound Effects v2 through the connected account, 4 takes each, prompt influence 0.75, fixed length, no loop. Round one: 12 sounds, 48 takes, about 140 credits. Round two: 4 sounds, 16 takes, about 36 credits. Round three: 5 sounds, 20 takes, 40 credits.
- The human picks takes on a picker page and can leave a note per sound. Picks are stored in the page's database, collection `picks`, one document per job: `{choice: "<label>_<n>" | "redo" | "none", note}`.
  - Round one: "Fallback Sound Picker", https://claude.ai/artifact/Tybxk4ZABSdF8L5DzXK5c6 (source in `sound-picker/`). Answered.
  - Round two: "Fallback Sound Picker 2", https://claude.ai/artifact/6JuV4MSQ3FfVu1eUHnh4hL (source in `sound-picker/round2/`). Answered. It also listed the fifteen edited sounds; a flagged one is stored as `picks/rev_<sound>` = `{choice: "change", note}`.
  - Round three: "Fallback Sound Picker 3", https://claude.ai/artifact/RanySU19mQXes9mdyq6oht (source in `sound-picker/round3/`). **Waiting for the human.**
- Only the six picked source takes are in the repo (`sound-edit/raw/`). Every take's generation id is in `sound-picker/generations.json`, `sound-picker/round2/generations.json` and `sound-picker/round3/generations.json`.
- AI-generated: credit as "ElevenLabs Sound Effects v2 (AI)". The account is on the Starter plan; confirm its licence covers a shipped app before release.

## Round-one picks (2026-11-17)

| Job | Pick | Note from the human |
|---|---|---|
| The done sound | `iron_ting_3` | |
| Skip, and something went wrong | `wood_knock_1` | |
| Switches and step ticks | `switch_click_1` | |
| Ticking a to-do | `pencil_check_1` | "where would this be used though?" Answer: when a to-do is ticked on the To-dos tab. |
| Undo, menus, next step | no sound | "use no 4 for the sound in moved to tomorrow" (so `swish_4` is the moved-to-tomorrow sound) |
| Saved | redo | "I'm not a fan of wood saving things" |
| Badge earned and level up | redo | Not the sound, the thing: a coin does not say "earned a badge". |
| Fallback AI | `glass_flick_2` | |
| Buttons and tabs | no answer | Silent for now; asked again in round two. |
| Moved to tomorrow (calendar page) | no answer | Replaced by `swish_4`, as the note asks. |

## Round-two answers (2026-11-17)

| Job | Answer | Note from the human |
|---|---|---|
| Badge earned | `ting_badge_1` (built from the chosen iron hit: two quick hits, then one a fifth higher, wide echo) | |
| Buttons and tabs | redo | "I'm not really feeling these ones either" |
| Skip today (flagged in the review list) | change | "I can't even hear anything, so another sound it is then" |
| Saved | no answer | Silent for now; asked again in round three. |

**Why the knock could not be heard (measured).** Running each take through a 500 Hz high-pass, which is roughly what a phone speaker does, the picked knock (`wood_knock_1`) loses 29 dB: almost all of it is low thud. The four fingertip taps lose 12 to 24 dB, which is very likely why they also felt wrong. Everything else in the edited set loses under 2 dB. "Could not save" is cut from the same knock, so it has the same problem and is replaced with whatever is picked for Skip.

**Rule from now on:** a take is only offered if it keeps most of its level above 500 Hz (loses under 10 dB) and is not near-silent at source. Round three was filtered this way: `nail_tap_4` and `cork_pop_2` to `_4` were dropped before the human saw them.

Round three offers: Skip today (playing card flicked onto a table, calendar page flipped, cork pulled from a bottle), Buttons and tabs (one key on a quiet keyboard, fingernail on hard plastic, water drop into a cup), and Saved again (metal latch, rubber stamp).

## Round-three answers (2026-11-17)

| Job | Pick | Note from the human |
|---|---|---|
| Buttons and tabs | `nail_tap_1` (a fingernail on hard plastic) | |
| Saved | `stamp_1` (a rubber stamp) | |
| Skip today | `page_flip_2` (a calendar page flipped) | |

"Could not save" is cut from the Skip pick, as round two said it would be: the same page flip twice, the second lower. The wood knock is no longer used anywhere and its take is removed from `sound-edit/raw/`.

Measured after the edit, through the same 500 Hz high-pass: the tap loses 2.7 dB, the stamp 0.3, the page flip 0.1, the double flip 0.2. All four will come through a phone speaker.

## Round-four answers (2026-11-17, after using the preview)

- Tabs are silent (bottom bar and segmented tabs). Only buttons and switches sound.
- The plus button, the add-menu rows and the "Tell Fallback AI" button play `tap`.
- Switches play `tap` both ways; `toggle_on` and `toggle_off` are bundled but unused.
- Rewards wait: `badge_earned`, `level_up` and `day_complete` start only after the sound
  already playing has ended plus 500 ms, and never over each other. The milestone pop-up
  appears with its sound. The rule and each sound's measured length are in
  `src/services/sfx/timing.ts` (shared by the app and the preview).

## The edit (sound director pass)

`sound-edit/edit.py` (needs ffmpeg) cuts all eighteen sounds from `sound-edit/raw/` into `sound-edit/out/` as 32 kHz mono 16-bit WAV, 966 KB in total, and writes `out/report.json` with the measured levels.

Each source take is trimmed to the useful part, high-passed to remove rumble, faded at both ends and brought to the same peak. Then:

- **Levels follow how often a sound is heard.** The button and tab tap is heard most, so it is the quietest (peak -17 dBFS) and the shortest (0.135 s). Switches and ticks come next (-15 to -12), logging and saving sit in the middle (-10 to -5), and the rare, happy sounds are the loudest (-4 and -3).
- **Echo only on the rare ones.** Frequent sounds are dry. Day finished, reminder and assistant finished get a short soft echo (`aecho=0.9:0.5:110|230:0.22|0.10`); level up and badge earned get a wider one (`aecho=0.9:0.6:120|250|390:0.30|0.16|0.08`).
- **One family.** Done, fallback, day finished, level up, badge earned and reminder are all the same iron hit, so they belong together: more hits and a higher finish mean a bigger moment. Fallback is deliberately one softer, duller hit next to Done's two.

| Sound | Plays when | How it is cut | Source take | Seconds | Peak dBFS | Echo |
|---|---|---|---|---|---|---|
| `log_ideal` | Logging a task as done | Iron hit twice, the second 5 semitones up, 140 ms apart | `iron_ting_3` | 1.15 | -4.9 | none |
| `log_fallback` | Logging the fallback | One iron hit, highs rolled off at 5.2 kHz | `iron_ting_3` | 0.85 | -8.0 | none |
| `log_skip` | Skip today | One page flip: the quiet lead-in is cut so it starts on the press, and it ends after the first small rustle | `page_flip_2` | 0.43 | -9.2 | none |
| `day_complete` | Last open task of the day logged (only when the day has more than one task) | Four rising iron hits (0, +4, +7, +12 semitones), 110 ms apart | `iron_ting_3` | 1.9 | -4.1 | soft |
| `level_up` | Reaching a new level (700 ms after the log sound) | Five rising iron hits (0, +4, +7, +12, +16) | `iron_ting_3` | 2.3 | -3.3 | wide |
| `badge_earned` | A badge pop-up appears (600 ms after it opens) | Two quick iron hits, then one 7 semitones up, 120 and 280 ms apart | `iron_ting_3` | 2.0 | -4.0 | wide |
| `reminder` | With a notification; in the preview, tapping a sample notification | Two iron hits (0, +7), 320 ms apart, highs rolled off at 4.8 kHz | `iron_ting_3` | 1.6 | -6.1 | soft |
| `error` | A warning toast (something could not be saved) | The short first part of the page flip twice, the second 4 semitones down and a little quieter, 210 ms apart | `page_flip_2` | 0.5 | -8.2 | none |
| `tap` | Pressing any kit button, changing bottom tab, changing a segmented tab | The nail hit alone, tail faded fast | `nail_tap_1` | 0.135 | -16.9 | none |
| `saved` | A plain green toast: a routine, event, course, to-do, note or widget choice saved, a backup made or restored, a copy made | One stamp, trimmed | `stamp_1` | 0.22 | -9.6 | none |
| `toggle_on` | Any switch turned on | Switch click, 3 semitones up | `switch_click_1` | 0.22 | -15.2 | none |
| `toggle_off` | Any switch turned off | Switch click, 3 semitones down | `switch_click_1` | 0.26 | -13.5 | none |
| `step_tick` | Ticking a checkbox (a routine step) | Switch click, unpitched | `switch_click_1` | 0.24 | -12.0 | none |
| `todo_done` | Ticking a to-do on the To-dos tab | Pencil check mark, trimmed | `pencil_check_1` | 0.62 | -9.8 | none |
| `snooze` | Moving a task to tomorrow | Paper swish take 4, trimmed | `swish_4` | 0.4 | -9.9 | none |
| `ai_start` | Assistant microphone starts listening | Glass flick, 4 semitones up | `glass_flick_2` | 0.6 | -8.9 | none |
| `ai_stop` | Assistant microphone stops listening | Glass flick, 3 semitones down | `glass_flick_2` | 0.7 | -8.8 | none |
| `ai_done` | Not used yet (made for "assistant finished") | Two glass flicks (0, +7), 160 ms apart | `glass_flick_2` | 1.3 | -8.3 | soft |

## Where it lives in the preview

- `src/services/sfx/index.ts`: `play(name, delayMs?)` and `useSoundStore` (`on`, `setOn`). Web Audio in the browser preview; the audio is inlined in `sounds.generated.ts`, which is left out of the patch (rebuild it with `python3 sound-edit/make_ts.py <path>`).
- Hooks: `src/features/task/logFeedback.ts` (done, fallback, skip, level up), `TodayScreen.handleLog` (day finished), `src/app-shell/stores/toast.ts` (warning toasts play `error`; success toasts without an icon play `saved`; log toasts carry an icon and keep their own sound), `src/ui/Button.tsx`, `src/ui/Tabs.tsx` and the `tabPress` listener in `app/(tabs)/_layout.tsx` (tap), `src/ui/Switch.tsx`, `src/ui/Checkbox.tsx`, `ToDosBrowseScreen.toggleDone`, `app/task/[id]/index.tsx` (moved to tomorrow), `app/assistant/index.tsx` and `chat.tsx` (microphone), `NotificationSample` (reminder), `src/features/progress/CelebrationHost.tsx` (badge earned: it belongs to the pop-up, so a queued badge sounds when it is shown).
- Settings has a "Sounds" switch ("Small sounds when you log, tick and switch things."). Turning it on plays the switch sound; turning it off is silent.
- Silent on purpose: undo, menus (the human chose no sound). Also left silent, by the orchestrator's choice, so the tap does not become noise: icon buttons (back arrows, the add button, close crosses), list rows, chips, date and option pickers, and the Done / Fallback / Skip controls, which have their own sounds. Onboarding's Continue is a kit button, so it now taps.
- A save is two sounds close together: the tap of the button, then the stamp when the save has gone through. Checked in a browser with `preview-harness/sfxcheck4.js`: bottom tab plays the tap, Skip today plays the flip, Save to-do plays the tap then the stamp.

**Preview versions 1 to 20 were silent.** The clips were loaded with `fetch`, which the artifact viewer refuses even for inlined data. Fixed in version 21 (decoded from the inlined text instead); `preview-harness/sfxcheck5.js` checks the published page under a no-network policy. The human had not heard any edited sound in the app before version 21.

## Still needed before builders touch it

- A line in the PRD (sound is a new feature) and a `sounds` setting stored with the other settings (the preview keeps it in the browser only).
- The architect's choice of audio library for the phone build, the sounds bundled as files, and silence when the phone is on silent.
- The reminder sound attached to real notifications (a notification sound file per platform).
- The human's ear on the round-three edit (levels were set by measurement, not by listening), and a yes or no on which controls tap.
