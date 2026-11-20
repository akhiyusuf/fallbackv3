# 45 - Wording consistency (round 4, edge campaign)

Owner: Haiku agent, round 4 area WORDING. Copy and string literals only. No logic changed.
New test: `src/edge.wording.test.ts` (19 tests, all passing).

## Status

- `src/edge.wording.test.ts`: 19/19 pass.
- `npx tsc --noEmit`: no errors in files I touched. Remaining errors are in other agents' new tests
  (`src/db/__tests__/edge.backupAllFields.test.ts`, `src/features/today/edge.renderCost.test.tsx`,
  `app/edge.screensA11y.test.tsx`, `src/queries/edge.undo.test.tsx`), none in copy or wording lines.
- Affected test files (46, selected because they assert changed wording): one jest run was started, but it
  did not finish under machine load. Failures found so far were old wording in assertions; those were fixed
  (see below). **Not yet confirmed: a clean re-run of the 46 files.** The main session should run them.

## Decisions (one name per concept)

- Generic noun: **task** (never "habit"). Routine, Event, Course, To-do stay as type names.
- Metric: **Consistency** (never "Showing up" as a label). "showed up" stays as the verb in prose.
- **Emergency day off**, **Push to tomorrow** (not "move"), **Recently deleted**, **Delete forever**
  (not "for good"), **End routine** / **Start again**, **Ideal** / **Fallback**.
- **Try again** is the one retry word (was "Retry" on banners and buttons).
- American **color**; **and** not **&** in labels ("Theme and accent", "Account and sync", "Help and about",
  "FAQ and guides").
- Toasts end with a full stop (ellipsis only when still in progress).
- Errors say what happened and what to do; contractions ("Couldn't", not "Could not").
- Straight apostrophes and straight double quotes (no curly quotes).
- No-value placeholder is a hyphen "-" everywhere (matches the Today ring from round 2). **Decision for main
  session:** DESIGN_DECISIONS round 4 chose the en dash; round 2 changed it to hyphen. Revert in one place if
  the human prefers the en dash.

## Changes, old -> new

Terms:
- "Build habits that survive your worst days, not just your best ones." -> "Build tasks that survive ..."
- "a plan A and a plan B for every habit." -> "A plan A and a plan B for every task." (capitalised)
- "Gentle nudges for due habits" -> "... due tasks"
- "A quiet reminder when a habit is due, ... after an off day. That's it." -> "... when a task is due, ... after an off day." (cut "That's it.")
- "Add your first habit." -> "Add your first task."; "Your first habit is set." -> "Your first task is set."
- "day-to-day habits you show up for" -> "day-to-day tasks ..."; "Courses are habits" -> "Courses are tasks"
- "Every habit comes with both." -> "Every task comes with both."; "your habit data" -> "your task data"
- "For something occasional, not a daily habit" -> "... not a daily task"
- Agents: "look at your habits" -> "look at your tasks"; "Check in on today's habits." -> "... tasks." (2 places)
- Assistant: "To delete a habit, say its name" -> "To delete a task, say its name"

Consistency:
- Today stat label "Showing up" -> "Consistency"; Settings "% showing up, last 30 days" -> "% consistency, last 30 days"
- Achievements category "Showing up" -> "Consistency"
- Level-up body "That's real consistency showing up, not luck." -> "That's consistency, not luck."

Push, emergency day off, deleted:
- "Can be moved to tomorrow" -> "Can be pushed to tomorrow" (switch label, and the routine footer)
- Whole-day toast "Day off. Nothing due today counts against you." -> "Emergency day off. Nothing counts against you." (+1 char)
- Task-page off toast "Taken off today" -> "Emergency day off." (its detail "Won't count" kept)
- Assistant "from Settings, Data." -> "from Settings > Data." (matches the Data toast)
- "Deleted for good" -> "Deleted forever." (toast); "delete it for good" -> "delete it forever"; "removed for good on" -> "removed forever on";
  "go for good" -> "go forever" (2 confirm bodies); "It was deleted for good" -> "It was deleted forever"
- "Moved to Recently deleted" toast now ends with a full stop.
- "Get reminders right on time" -> "Ring reminders on time" (same name as the Settings row)

Labels:
- "Theme & accent" -> "Theme and accent"; "Account & sync" -> "Account and sync"; "Help & about" -> "Help and about";
  "FAQ & guides" -> "FAQ and guides" (the label map in `app/settings/help.tsx` was removed as redundant)
- "Colour"/"colour" -> "Color"/"color" in visible copy (section headings, "Icon and color", "More colors",
  "recolors", "Pick a color", "Your color"); identifiers such as `moreColoursLabel` are unchanged
- "Medium" -> "Med" (priority picker, matching the search chip; "Med" keeps the length the same or shorter)
- "Retry" -> "Try again" (all banner and button labels and defaults)
- "–" -> "-" for no value: `app/records/[cycleId].tsx`, `app/records/index.tsx`, `app/settings/subscription.tsx`,
  `src/features/today/StatHero.tsx`, `src/ui/TrendGraph.tsx` (5 cells)

Toasts (full stop added): "Logged to history", "Undone", "Push undone", "Pushed to tomorrow", "Back on today",
"Course saved", "Note saved", "To-do saved", "Event saved", "Routine saved", "Log cleared", "Ideal done",
"Fallback done", "Done", "Skipped for today", "Started again from today", "All agents disconnected",
"Saved", "Restored. Fallback AI is active", "Backed up <time>", "Backup file saved to the folder you chose",
"Backed up on this phone, but couldn't save a copy to that folder", "Restored \"<name>\"",
"Duplicated. You are now on the copy." -> "Duplicated. You're now on the copy.", "Connected." (was "Connected. You're all set.")

Errors:
- "Couldn't save. Try again" / "Couldn't save that. Try again" / "Couldn't back up. Try again" -> full stop added
- "Add a name to continue" (and ideal, fallback versions) -> full stop added
- "Could not save that. Try again." -> "Couldn't save that. Try again." (chat)
- "Could not reach your AI endpoint." -> "Couldn't reach your AI endpoint. Try again." (3 places, services/ai/byoProvider.ts)
- "Could not reach the assistant." -> "Couldn't reach the assistant. Try again." (managedProvider.ts, 2)
- "Could not reach the transcription service." -> "Couldn't reach the transcription service. Try again."
- "Could not connect to the store." / "Could not reach the store." -> "Couldn't reach the store. Try again." (billing, 3)
- "Biometric confirmation could not start." -> "Couldn't start biometric confirmation. Try again."
- "Could not establish the current cycle pointer." -> "Couldn't establish ..." (src/queries/mutations.ts)
- Recovery (S50): headline "Let's get you back on track" -> "We couldn't read your data on this device."; body
  "We couldn't read your data on this device. Nothing is deleted. You can try again, or reset and start fresh."
  -> "Nothing is deleted. Try again, or reset and start fresh." (AI tell removed; each line now does one job)
- Settle on "Something went wrong" as the generic wording: unchanged.

Filler and AI tells:
- "Nothing to lose here. We count how often you show up. A fallback still counts." -> "We count how often you show up, and a fallback still counts."
- "Nothing to lose here. Off days are neutral, ..." -> "Off days are neutral, ..."
- Milestone notification "... a new level or badge. Nice work." -> "... a new level or badge." (2 places)
- "No worries. Let me know which one whenever you're ready." -> "Okay. Tell me which one when you're ready." (2 places)
- Assistant summary "... slammed 🌱" -> "... slammed" (emoji removed)
- Pinned tenure body "That's not a performance score, that's just time." -> "It measures time, not performance." (kept meaning; pinned copy, noted)
- Generic tenure body -> "Calendar time with Fallback, however those days went. It measures time, not performance."
- "..." -> "…" in a truncated reason (FirstTaskScreen)

## Tests updated

Mechanical replacement of the same strings across all `app/` and `src/` test files, plus targeted fixes:
- `src/features/today/TodayScreen.test.tsx`: toast messages "Ideal done." and "Fallback done."
- `src/features/assistant/__tests__/edge.conversations.test.tsx`: `/Okay. Tell me/`
- `app/edge.journeys.test.tsx`, `app/task/[id]/celebrate.test.tsx`: toast messages with the full stop; `/^Consistency/` label
- `app/edge.weekOfUse.test.tsx`: `/^Consistency/` labels; "Restored \"Gym\"."
- `app/task/[id]/recentlyDeleted.test.tsx`, `app/settings/data/deleted.test.tsx`: "Restored \"Morning workout\"."
- Two test-only string fixes where the replacement had broken quoting (recentlyDeleted sheet names, edge.today list)
No existing assertion was weakened; each changed assertion expects the new wording.

## Left for the main session

1. **Skip**: the human removed Skip from every log control. Still visible: the legacy "Skipped" label for old skip logs
   (`src/ui/LogControl.tsx`), the "Skipped for today" toast on the legacy skip path (`src/features/task/logFeedback.ts`),
   the Settings > Notifications/agent permission text "Log done, fallback or skip" (`src/features/agents/store.ts`).
   Kept on purpose for old data; the main session should decide whether the agent permission text changes.
2. **No-value dash**: see Decisions above.
3. **Length**: a few changes grew by 1 to 4 characters where a term had to change ("Emergency day off", "pushed",
   "Couldn't ... Try again."). The brief asked for same-or-shorter; these are the exceptions.
4. **Verbatim copy**: many strings were quoted from the human's handoff (`design-input/`). Changed ones are listed above;
   the human should see them as rendered output. design-input itself is not edited.
5. Other agents' uncommitted files were edited by string replacement only, so their changes are preserved.
