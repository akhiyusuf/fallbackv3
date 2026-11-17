# 07 — Tests for the four review fixes

Scope: tests only. No app code was changed. Four small fixes made by the main session during its final
review now have tests in the existing test files next to their screens.

## Result

| Check | Result |
|---|---|
| `npx jest` on the four test files (verbose) | 4 of 4 suites pass, **40 of 40 tests pass** |
| `npx tsc --noEmit` | no output, exit 0 |
| `npx eslint <the four test files> --quiet` | no output, exit 0 |

Files touched (all tests, no app code):

- `src/features/onboarding/OnboardingShell.test.tsx`
- `app/onboarding/first-task.test.tsx`
- `src/features/browse/ToDosBrowseScreen.test.tsx`
- `app/settings/data/index.test.tsx`

---

## 1. Onboarding Skip waits for the save

**File:** `src/features/onboarding/OnboardingShell.test.tsx` (new `describe` block, 3 tests)

The `@/queries` mock was changed from a fresh `jest.fn()` per call to one shared
`mockUpdateSettingsMutateAsync`, so the test can see the save and set its result. Toast state is read
from the real `useToastStore`. Navigation is read through the `router.replace` spy the same way
`first-task.test.tsx` does it.

| Test | Asserts |
|---|---|
| `a saved Skip navigates to /today and shows no toast` | Save called once with `onboardingCompletedAt`; `router.replace('/today')`; no toast. |
| `a failed save ({ ok: false }) shows the warning toast and does not navigate` | Toast message is `ONBOARDING_SHELL_COPY.skipFailure`, tone `warning`; `router.replace` not called. |
| `a save that throws shows the same warning toast and does not navigate` | Same as above when `mutateAsync` rejects. |

Result: 3 of 3 pass. Whole file 8 of 8 pass (the 5 existing tests still pass).

**Note on placement.** The new `describe` sits ABOVE the existing step tests in the file. In the
original order, the Skip tests rendered an empty tree and could not find the Skip button (tried several
fixes: pinning the window size, waiting for the 420 ms banner animation, rendering through `renderAt`).
Every one of those failed. Running the Skip tests alone, or after the first four tests, passed. The
trigger was the existing `Back is hidden on step 1 and shown from step 2` test, which unmounts and
re-renders in the same file. I did not find the root cause. The reordering is a workaround, so a later
change to that test may bring the problem back. It is in the file as a comment.

## 2. First habit: no duplicate routine

**File:** `app/onboarding/first-task.test.tsx` (1 new test)

| Test | Asserts |
|---|---|
| `a failed "onboarding finished" save keeps the screen; the next Save does not create the routine again` | First Save: the routine create runs once, the onboarding save returns `{ ok: false }`, the `S08_COPY.saveFailure` toast shows, `router.replace` is NOT called, the typed name is still on screen. Second Save: `router.replace('/today?justAdded=1')` is called; the create mutation was still called exactly once across both presses; the settings save was called twice. |

Result: 7 of 7 tests in the file pass.

## 3. To-dos tick failure, and the checkbox label

**File:** `src/features/browse/ToDosBrowseScreen.test.tsx` (4 new tests). No existing test asserted the old
`", done"` label, so none had to change.

| Test | Asserts |
|---|---|
| `a tick that the save rejects shows the "Couldn't save" warning, plays no done sound and shows no Done toast` | `{ ok: false }` from the write: toast is `SAVE_FAILED`, tone `warning`; `play('todo_done')` not called. |
| `a tick whose write throws shows the same "Couldn't save" warning` | A rejected write shows `SAVE_FAILED` with tone `warning`. |
| `a failed Undo shows the "Couldn't save" warning in place of the Done toast` | Tick succeeds (Done toast with Undo), then Undo fails: toast becomes `SAVE_FAILED`, tone `warning`; the write was called twice. |
| `the checkbox is named by the to-do alone; its ticked state is carried by checked, not by the name` | Open to-do: checkbox with exact name `Renew passport` and `checked: false`. Done to-do: exact name and `checked: true`. Neither has the name `Renew passport, done`. |

Result: 12 of 12 tests in the file pass (8 existing, 4 new).

## 4. Restore picker failure

**File:** `app/settings/data/index.test.tsx` (1 new test)

| Test | Asserts |
|---|---|
| `a file picker that fails to open shows the same restore failure banner and starts no restore` | `getDocumentAsync` rejects: `S47_COPY.restoreFailure` banner appears; `restoreBackup` is not called. |

Result: 13 of 13 tests in the file pass. This file also contains a test named `a restored backup brings
its own look (theme and colour) back straight away`, which I did not write. It was added by another agent
while I was working, and I left it alone.

---

## Anything I could not test, or that looked wrong

1. **Skip test order and the empty-render problem** (section 1). The tests pass, but only because they run
   before the step tests in the file. The root cause is not known. Worth a look by whoever next edits
   `OnboardingShell.test.tsx`.

2. **Wording on a picker failure (app/settings/data/index.tsx).** When the phone's file picker itself
   fails, the screen shows `S47_COPY.restoreFailure`: "We couldn't read the backup file. Your current data is
   untouched — nothing was overwritten." The picker failing is not the same as the file being unreadable.
   The brief asked for the same state, so I kept it; the copy may want a separate line. Needs a person's
   wording decision.

3. **Punctuation of the two "could not save" messages differs.** `SAVE_FAILED` in
   `src/features/task/formShared.ts` is "Couldn't save that — try again." (with a full stop). The onboarding
   skip message `ONBOARDING_SHELL_COPY.skipFailure` in `src/features/onboarding/copy.ts` is "Couldn't save
   that — try again" (no full stop). Not changed; a copy decision for a person.

4. **First habit: a retry after a failed finish save keeps the first routine's text.** Once the routine is
   created, `createdRef` stops a second create. If the person then edits the name or ideal on the screen and
   presses Save again, the edits are dropped silently, since only the finish save runs again. The brief's
   fix is as described, so this is a behaviour to know about rather than a bug in the fix.

5. **Concurrent edits.** Two of the four test files (`ToDosBrowseScreen.test.tsx` and
   `app/settings/data/index.test.tsx`) were changed on disk by another agent while I was editing them. My
   tests are present in both files, and the final verbose run included them, but I did not compare against
   the other agent's version.

6. **Nothing else was left untested in these four areas.** The app code was not changed, so no further
   test changes were needed.

## Shared files touched

None. All four edits are in test files in the listed areas.

---

## Follow-up by the main session

The order problem in section 1 had a plain cause: the existing Back test called `unmount()` without
`await` (in this version of the test library `unmount()` returns a promise), so the unmount was still
running when the next test rendered. Both calls are now awaited, the Skip tests are back below the step
tests, and the file passes 8 of 8 in that order. The workaround comment was removed.
