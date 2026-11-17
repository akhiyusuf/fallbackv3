# Sound effects for the prototype

28 sounds to generate. Recorded here so the list survives the session; the copyable version is the *Fallback Sound List* artifact.

## Settings for every sound

- Tool: any text-to-sound tool. Written for ElevenLabs Sound Effects (v2).
- Duration: the seconds given per sound. Set it by hand; do not leave it on auto.
- Prompt influence: high, about 75%.
- Loop: off.
- Takes: 3 or 4 per sound, so the best one can be picked.
- No voices, no music bed, no long echo.
- File names: `<name>_1.mp3`, `<name>_2.mp3` and so on (mp3, wav or ogg). Do not trim; trimming and levelling happen when they are wired in.
- Send them as one zip.

## Logging a habit

The heart of the app. Fallback must sound like a win too, only calmer. Never a sad or lesser sound.

| File | Plays when | Seconds | Prompt |
|---|---|---|---|
| `log_ideal` | You tap Done (the ideal). | 1.0 | Wooden marimba, two quick rising notes in C major, bright and warm, single short phrase, close microphone, dry studio recording, no reverb |
| `log_fallback` | You tap Fallback. | 1.0 | Wooden marimba, one soft warm middle note in C major with a short gentle ring, single note, close microphone, dry studio recording, no reverb |
| `log_skip` | You tap Skip today. | 0.5 | Felt mallet on a wooden block, one soft low muted knock, single sound, close microphone, dry foley recording |
| `undo` | You tap Undo on any toast, or clear a log. | 0.5 | Sheet of paper, one quick light backward swish, single sound, close microphone, dry foley recording |
| `step_tick` | You tick one step of a routine. | 0.5 | Ballpoint pen, one small crisp click, single sound, close microphone, dry foley recording |
| `todo_done` | You tick a to-do. | 0.7 | Pencil on paper, one quick short check mark scratch then a light tap, single sound, close microphone, dry foley recording |
| `day_complete` | The last thing due today gets logged. | 2.0 | Wooden marimba, quick rising run of four notes in C major ending on a bright high note with a short ring, joyful, single phrase, close microphone, dry studio recording |
| `day_off` | You mark today off. | 0.6 | Small soft pillow, one gentle muffled pat, single sound, close microphone, dry foley recording |
| `snooze` | You move a task to tomorrow. | 0.7 | Paper desk calendar, one quick page flip, single sound, close microphone, dry foley recording |

## Rewards

Short and happy. These play on top of a log sound, so they start a beat later.

| File | Plays when | Seconds | Prompt |
|---|---|---|---|
| `level_up` | You reach a new level. | 2.5 | Wooden marimba with a small glockenspiel, bright rising fanfare of five notes in C major, joyful, short sparkle at the end, single phrase, close microphone, dry studio recording |
| `badge_earned` | You earn a badge. | 1.5 | Metal coin, one bright coin spinning and settling quickly on a wooden table, single sound, close microphone, dry foley recording |

## Buttons and moving around

Very quiet, very short. These play hundreds of times, so they must never be annoying.

| File | Plays when | Seconds | Prompt |
|---|---|---|---|
| `tap` | Any main button press. | 0.5 | Small wooden button, one soft short muted tap, single sound, close microphone, dry foley recording |
| `tab_switch` | You change tabs at the bottom. | 0.5 | Felt pad, one light quick soft pop, single sound, close microphone, dry foley recording |
| `toggle_on` | A switch turns on. | 0.5 | Small plastic light switch, one soft click, higher pitched, single sound, close microphone, dry foley recording |
| `toggle_off` | A switch turns off. | 0.5 | Small plastic light switch, one soft click, lower pitched and duller, single sound, close microphone, dry foley recording |
| `sheet_open` | The add menu or a dialog opens, and the next onboarding step. | 0.5 | Soft air, one short quick upward swish, single sound, close microphone, dry foley recording |
| `sheet_close` | A menu or dialog closes. | 0.5 | Soft air, one short quick downward swish, single sound, close microphone, dry foley recording |
| `save_task` | A new routine, event, course or to-do is saved. | 0.6 | Wooden toy block dropped into a wooden slot, one short satisfying clunk, single sound, close microphone, dry foley recording |
| `delete` | Something is deleted. | 0.7 | Sheet of paper, one quick crumple, single sound, close microphone, dry foley recording |
| `reorder` | You move a priority up or down. | 0.5 | Wooden game tile, one short slide across a wooden table and stop, single sound, close microphone, dry foley recording |
| `theme_change` | You pick a theme or colour. | 0.5 | Water, one single bright drop falling into a full glass, single plop, close microphone, dry recording |
| `error` | Something could not be saved. | 0.6 | Low wooden block, two quick dull muted knocks, single sound, close microphone, dry foley recording |

## Fallback AI

A different material from the rest (glass, not wood) so the AI has its own voice.

| File | Plays when | Seconds | Prompt |
|---|---|---|---|
| `ai_listen_start` | Fallback AI starts listening. | 0.8 | Small glass chime, two quick soft rising notes, airy, single phrase, close microphone, dry studio recording |
| `ai_listen_stop` | Fallback AI stops listening. | 0.8 | Small glass chime, two quick soft falling notes, airy, single phrase, close microphone, dry studio recording |
| `ai_send` | You send a typed message to Fallback AI. | 0.5 | Soap bubble, one light soft pop, single sound, close microphone, dry foley recording |
| `ai_done` | Fallback AI finishes setting something up. | 1.5 | Small glass chimes, quick rising shimmer of three notes ending bright with a short ring, single phrase, close microphone, dry studio recording |

## Reminders and first run

| File | Plays when | Seconds | Prompt |
|---|---|---|---|
| `reminder` | A reminder arrives (you can also hear it by tapping a sample in Settings, Notifications). | 1.5 | Wooden marimba, two gentle calm notes in C major, the second a little higher, short soft ring, single phrase, close microphone, dry studio recording |
| `welcome` | You finish onboarding and land on Today for the first time. | 2.0 | Wooden marimba, warm friendly rising phrase of three notes in C major with a soft ring, single phrase, close microphone, dry studio recording |

## When the zip arrives

- Trim, level and pick one take per sound; wire them into the preview behind one `play(name)` helper.
- Add a Sounds switch in Settings (on by default in the preview) and keep silence when the phone is on silent.
- This is a new feature: it needs a line in the PRD and the architect's choice of audio library (expo-audio) before builders touch it.
