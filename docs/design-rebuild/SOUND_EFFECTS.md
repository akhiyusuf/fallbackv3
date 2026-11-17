# Sound effects for the prototype

Rule from the human (2026-11-17): **no musical instruments in the app.** Sounds are things hitting things (an iron rod on an iron bar, not a bell).

Rule from the human: do not go overboard. Twelve short source sounds were generated; every sound the app plays is cut from one of them by editing (trim, level, pitch, repeats, echo where it helps).

## How they are made

- Generated with ElevenLabs Sound Effects v2 through the connected account, 4 takes each, prompt influence 0.75, fixed length, no loop. 48 clips, about 140 credits.
- The human picks one take per job on the "Fallback Sound Picker" page (https://claude.ai/artifact/Tybxk4ZABSdF8L5DzXK5c6) and can leave a note per sound. Picks are stored in that page's database, collection `picks`, one document per job: `{choice: "<label>_<n>" | "redo" | "none", note}`.
- The raw takes are not in the repo (they live in the ElevenLabs flow "Fallback app sounds"); `docs/design-rebuild/sound-picker/generations.json` lists every take's generation id.
- Each pick is then edited: levels matched across the set, tails trimmed, pitch and repeats used to make the variants, echo only where it suits.
- AI-generated: credit as "ElevenLabs Sound Effects v2 (AI)". The account is on the Starter plan; confirm its licence covers a shipped app before release.

## Source sounds and where each is used

| Job in the app | Source sound | Seconds | Prompt |
|---|---|---|---|
| The done sound | `iron_ting` (Iron rod on an iron bar) | 1.5 | Small iron rod striking a thick hanging iron bar once, clear bright ringing ting with a short ring, close-mic, dry |
| The done sound | `glass_clink` (Spoon on a glass jar) | 1.0 | Metal teaspoon tapping the side of a thick glass jar once, bright short clink, close-mic, dry |
| The done sound | `stone_click` (Two pebbles) | 0.6 | Two smooth river pebbles knocked together once, crisp bright click, close-mic, dry |
| Skip, and something went wrong | `wood_knock` (Knuckle on a wooden table) | 0.6 | Knuckle knocking once on a thick wooden table, soft low muted knock, close-mic, dry |
| Buttons and tabs | `tap` (Fingertip on a desk) | 0.5 | Fingertip tapping once on a wooden desk, very soft short muted tap, close-mic, dry |
| Switches and step ticks | `switch_click` (Light switch) | 0.5 | Small plastic light switch flicked once, soft crisp click, close-mic, dry |
| Ticking a to-do | `pencil_check` (Pencil check mark) | 0.7 | Pencil drawing one quick check mark on paper, short scratch, close-mic, dry |
| Undo, menus, next step | `swish` (Paper through the air) | 0.6 | Sheet of paper swished quickly through the air once, short soft whoosh, close-mic, dry |
| Moved to tomorrow | `page_flip` (Calendar page) | 0.8 | Single paper calendar page flipped over quickly, close-mic, dry |
| Saved | `block_clunk` (Wooden block into a box) | 0.7 | Small wooden toy block dropped into a wooden box, one short solid clunk, close-mic, dry |
| Badge earned and level up | `coin` (Coin settling on a table) | 1.5 | Single metal coin spinning and settling quickly on a wooden table, bright, close-mic, dry |
| Fallback AI | `glass_flick` (Fingernail on a drinking glass) | 1.2 | Fingernail flicking the rim of a thin empty drinking glass once, soft high clear ping, close-mic, dry |

## Planned edits

- Done: two hits of the chosen done sound, the second pitched up. Fallback: one softer hit. All done for today: a short rising run. Reminder: two calm hits.
- Something went wrong: two quick knocks. Closing a menu: the swish reversed. Fallback AI start and stop: the glass flick pitched up and down.
- Level up: the rising run with the coin under it.

## Still needed before builders touch it

- A line in the PRD (sound is a new feature), a Sounds switch in Settings, silence when the phone is on silent, and the architect's choice of audio library.
