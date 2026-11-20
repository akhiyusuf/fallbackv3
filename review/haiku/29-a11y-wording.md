# 29 - Accessibility and wording (round 2, edge campaign)

Owner: Haiku agent for round 2, area ACCESSIBILITY and WORDING across the app.
Owned for fixes: `src/ui/**`, `src/theme/**`, copy constants (wording only).
New test files: `src/edge.copy.test.ts`, `src/ui/edge.a11y.test.tsx`.
Round 1 for this area: none in `review/haiku/` covered a11y as a sweep; the foundations report (00)
and the kit tests were read first.

Note on git: my edits were swept into commit `10b9c6e` ("Edge round 2: restarts and privacy passes...")
by a checkpoint commit made while I worked. I did not commit or push. The diff is in that commit.

## 1. Results

| Check | Result |
|---|---|
| `npx jest src/edge.copy.test.ts src/ui/edge.a11y.test.tsx --selectProjects app` | 2 suites, **141 tests passed** (55 copy, 86 a11y; the 2 KNOWN items are `it.failing`) |
| `npx jest src/ui src/edge.copy.test.ts --selectProjects app` (all kit suites plus the copy sweep) | 13 suites, **179 tests passed** |
| `npx tsc --noEmit` | no errors in my files. Two errors remain in other agents' files: `app/edge.journeys.test.tsx(24,24)` and `src/queries/edge.simulation.test.tsx(384,5)` |
| `npx eslint` on my new tests and every file I touched | 0 errors, 0 warnings |

Contrast, computed from the theme tokens (WCAG relative luminance), minimum over all 16 combinations
(light and dark, six named accents, two custom hues `hue-52`, `hue-276`):

| Pair | Minimum ratio |
|---|---|
| text on page / card / surface | 11.00 / 11.72 / 9.51 |
| textMuted on page / card / surface | 5.72 / 6.76 / 4.95 |
| textDim on page / card | 4.70 / 4.95 |
| accent text on page / card / accent tint | 4.61 / 5.41 / 4.50 |
| button label (`accent.on`) on accent fill | 4.54 |
| white on danger button | 4.63 |
| error text (`dangerDeep`) on page / card | 4.85 / 5.47 |
| ideal / fallback / off / gold chip text on its tint | 5.10 / 5.38 / 5.09 / 5.26 |

Every pair is at least 4.5:1 after the fixes below. Before the fixes, light error text on the page was
3.92 to 4.18:1 and dark error text on the card failed in every dark theme (2.98:1 to 3.12:1 in the two checked; see bug 2).

## 2. Tests added

### `src/edge.copy.test.ts` (wording sweep, 55 tests)

- **Discovery**: walks `src/` and `app/` and imports every module that exports a `*_COPY` object. It finds
  **50** objects, and fails if fewer than 50 are found or if one of nine named objects is missing. A new copy
  file cannot slip past the sweep.
- **One test per `*_COPY` object (50 tests)**: every string value, at any depth, is checked for em dash,
  en dash, double space, trailing space (keys ending `Prefix` / `Suffix` are fragments and are exempt, and
  the builders are checked on their joined output), space before a full stop, placeholder words (`TODO`,
  `FIXME`, `XXX`, `undefined`, `NaN`, `null`), `lorem` / `ipsum`, `[object Object]`, and an unfilled
  `{template}` token. **All 50 objects are clean.**
- **Copy builders over a grid of inputs** (`dueSectionLabel`, `tenureBodyFor` with every tier and an unknown
  key, `formatOneDecimal`, `resultsCountLabel` 0 to 1000, `statLine` and `reentryStatLine` for the window and
  count grid): **clean**.
- **`formatOneDecimal` never prints `NaN` or `Infinity`** (0, -0, 0.05, 1/3, 99.95, 1e9): passes.
- **Label builders outside the copy files** (`importanceLabel`, `necessityLabel`, `taskTypeLabel`,
  `formatWeekdaySet`, `cadenceLabel`, `cadenceHintLower`, `cadenceSummary`, `formatHeaderDate`,
  `formatTimeOfDay`, `shortDateLabel`, `todayLongLabel`, `dayLongLabel`): clean except the en dash ranges,
  which are the KNOWN item below.
- **KNOWN (`it.failing`)**: contiguous weekday ranges use an en dash. Lines are in bug 4 (not my files).

### `src/ui/edge.a11y.test.tsx` (86 tests)

One gallery renders the shared kit (Button in four variants plus disabled and loading, ListRow with
chevron, danger and disabled, Switch on and off, Tabs with three items, Checkbox on, off and disabled,
LogControl unlogged with push and emergency links, logged, IconButton accent, ghost, disabled, WeekdayPicker
multi and single with an error, StatHero with a value and with none, TaskCard, CalendarHeatmap with six
outcome kinds, Stepper, Badge, Tag, ConfirmSheet, MenuSheet, Dialog) in each of 16 themes.

- **Pressables have a role and a label (16 themes)**: every host node with a press handler has an
  `accessibilityRole` other than `none`, and a non-empty `accessibilityLabel`. **Passes.**
- **Disabled states are exposed**: disabled Button, ListRow, IconButton and both LogControl forms expose
  `accessibilityState.disabled: true`. **Passes.** (RN's `Pressable` merges its own `disabled` prop into
  `accessibilityState`, so the kit is correct; the test confirms it.)
- **Switch, checkbox and tab state**: on or off as `checked`, a disabled checkbox, and a selected and
  disabled tab. **Passes** after the test was corrected to use the right roles (`switch`, `checkbox`, `tab`).
- **Touch targets of primary controls at least 44 x 44 (16 themes)**: height from `minHeight`/`height`
  plus `hitSlop`. **Failed before the fix** (bug 1), now passes.
- **Contrast (16 themes x 19 pairs)**: see the table in section 1. **Passes** after bug 2 was fixed.
- **Wording of every rendered string (16 themes)**: the text children and the `accessibilityLabel` and
  `accessibilityHint` props of the whole gallery are checked with the same rules as the sweep. The bare
  "no value" en dash in StatHero is excluded by name here and recorded in the KNOWN test (bug 4).
- **Toast is a labelled alert (16 themes)**: the alert view has `accessibilityRole="alert"` and
  `accessibilityLiveRegion="polite"`, its Dismiss button is present, and the message is clean.
- **KNOWN (`it.failing`)**: StatHero with no value shows no en dash (bug 4).
- **Large text**: Button, ListRow, Checkbox and ConfirmSheet labels carry no `numberOfLines` cap below 2.
  The LogControl plan hint wraps to two lines. Tab labels wrap to two lines. **All pass** after bug 3.

Not simulated: font scale. Jest has no layout engine and no font-scale setting. The app has no in-app text
size setting of its own; it follows the phone's text size (React Native default). The check is static
(`numberOfLines` caps), and the real test is on a phone at the largest text size (section 5).

## 3. Bugs fixed (in my area)

1. **Tab touch target was 36 px tall.** `src/ui/Tabs.tsx:127` (new `hitSlop={{ top: 4, bottom: 4 }}`).
   The tab is 36 px in a 44 px bar; the slop makes its touch target 44 px with no visual change. How a
   person hits it: a thumb on a 36 px tab misses at the edge, most visibly on the 30-day and all-time tabs.

2. **Error text fails 4.5:1 on the page and the card.** `src/ui/Input.tsx:68`, `src/ui/DateField.tsx:191`,
   `src/ui/WeekdayPicker.tsx:73`: the helper and error text used `t.color.danger` (`#D93636` light,
   `#D93636` dark). Light on the page was 3.92 to 4.18:1 across the light themes; dark on the card was 2.98:1 (forge) and 3.12:1 (indigo), and failed in every dark theme. Fixed with
   `t.color.dangerDeep` (light `#C42727`, dark `#FF7A7A`), which is already in the palette and passes on
   every surface (4.85 to 7.59:1). The solid `danger` stays for buttons, which put white on it (4.63:1).
   **Visible change:** light error text is a little darker. This is the one look change in this round.
   I did not add a new palette key, so no fixture elsewhere had to change.

3. **Labels capped to one line that carry information.**
   `src/ui/LogControl.tsx:123`: the plan hint under Done and Fallback ("Ten minutes after waking up") was
   `numberOfLines={1}`, so at a large text size it was cut off. Now 2 lines (no fixed height, so no layout
   change at normal size). `src/ui/Tabs.tsx:131`: tab labels were 1 line with an ellipsis ("All ti...");
   now 2 lines (the tab grows only when the text needs it).

4. **Dash placeholders for "no value"** (human's policy in DESIGN_DECISIONS round 4 chose the short dash;
   this round's brief says en dashes fail, so these are now a plain hyphen). `src/ui/TrendGraph.tsx:142`,
   `:143`, `:144`, `:145`, `:146` (table cells) and `src/ui/ConsistencyRing.tsx:50`. Replaced `'–'` with
   `'-'`. **This is a departure from the human's round-4 word** ("the short dash already used on the Today
   ring"). The Today ring is `ConsistencyRing`, so the Today ring now shows a hyphen as well. It is one
   character in one place to revert if the human prefers the en dash; the main session should decide.

## 4. Bugs found and left (not my files, or needs a decision)

Each needs a one-line change by the owner of that file. None is in `src/ui` or `src/theme`.

a. **En dash in visible ranges** (the brief: "replace with 'to' or a plain hyphen consistently"; I
   recommend "to" for ranges and "-" for no value, the same rule as fix 4):
   - `src/features/task/cadenceLabel.ts:21`: `Mon–Sat` (shown on Today and task pages through `cadenceSummary`).
     Test to update when fixed: `src/domain/edge.schedule.test.ts` lines 485, 518, 519, 529 assert `Mon–Sat`,
     `Mon–Sun`, `Sat–Sun`, `Mon–Tue`.
   - `src/features/browse/format.ts:46`: `formatWeekdaySet` range (browse meta lines).
   - `src/features/progress/format.ts:28`: `Week of Nov 16–22, 2026` (cycle record range). Not in the
     sweep (not a copy file): consider adding it to the sweep's builder list.
   - `src/features/today/StatHero.tsx:33`: bare `–` for no value on the Today hero.
   - `app/records/[cycleId].tsx:47` and `app/records/index.tsx:90`: bare `–` for no consistency.
   - `app/settings/subscription.tsx:140`: bare `–` for no renewal date.
   The first two are covered by the KNOWN test in `src/edge.copy.test.ts`; StatHero by the one in
   `src/ui/edge.a11y.test.tsx`. The other three are not tested; they need the same change.

b. **Error text in the light and dark themes fails 4.5:1** (same cause as fix 2, outside my files):
   `t.color.danger` used as text colour at `src/features/task/StepListEditor.tsx:91`,
   `app/task/[id]/index.tsx:616`, `app/add/routine.tsx:140` and `app/assistant/paywall/byo.tsx:105`.
   Change the text colour to `t.color.dangerDeep` (same as fix 2).

c. **Toast message sits inside the Dismiss button.** `src/ui/Toast.tsx:58-68`: the Dismiss `Pressable`
   has `accessibilityLabel="Dismiss"` and contains the message `Text`, so a screen reader that focuses the
   button hears "Dismiss" and not the message. The alert view above it carries the message as its label
   and `accessibilityLiveRegion="polite"`, so the message is announced when it appears, but it is not
   reachable by focus. I did not change this: the existing Toast test presses the button by its name
   "Dismiss", and a fix (for example moving the message out of the button) changes the structure every
   screen uses. **Needs a phone check with TalkBack and VoiceOver** before a decision.

d. **Large text, single-line caps left on purpose** (they truncate at large sizes; each is a judgment):
   `src/ui/ScreenHeader.tsx:43` (screen title), `src/ui/ListGroup.tsx:96` (right-hand value, e.g. a time),
   `src/ui/StatTile.tsx:30` (tile label), `src/ui/TabSummary.tsx:55` (summary title),
   `src/ui/SlidingTabBar.tsx:96` (bottom tab labels, layout-bound). A long habit name in a title is the
   most likely to be cut; the full text is still in the screen's accessibility label.

e. **Things the sweep does not cover**: the wording rules apply to copy objects, the listed builders and
   the gallery's rendered strings. Visible text in JSX in `app/` and `src/features/` (outside copy objects)
   is only partly covered: the gallery covers the shared kit only.

f. **Other agents' files with TypeScript errors (not mine, not changed):** `app/edge.journeys.test.tsx:24`
   (`CapturingClient` missing `clear`) and `src/queries/edge.simulation.test.tsx:384` (tuple indexed with a
   negative value).

## 5. Could not test here (needs a real phone)

- Screen-reader order, focus and announcement: VoiceOver on iOS and TalkBack on Android. The tests check
  the props the screen readers read, not what they say.
- Large text: the phone's largest text size on the Today, task and Browse screens, to see what wraps and what
  is cut (section 4d).
- Real touch: that the 44 px targets feel right with the chunky 3D edge of the buttons.
- Contrast on a real screen under daylight. The numbers above are the token values; the rendering adds a
  tint from the accent (already included in the engine's own checks).
- Reduced motion: the Tabs slide and Switch animation under the OS reduce-motion setting were not run.

## 6. Shared files touched

| File | Lines | Why |
|---|---|---|
| `src/ui/Tabs.tsx` | 127, 131 | touch target (fix 1); label wrap (fix 3) |
| `src/ui/LogControl.tsx` | 123 | hint wrap (fix 3) |
| `src/ui/Input.tsx` | 68 | error text colour (fix 2) |
| `src/ui/DateField.tsx` | 191 | error text colour (fix 2) |
| `src/ui/WeekdayPicker.tsx` | 73 | error text colour (fix 2) |
| `src/ui/TrendGraph.tsx` | 142-146 | no-value placeholder hyphen (fix 4) |
| `src/ui/ConsistencyRing.tsx` | 50 | no-value placeholder hyphen (fix 4) |

No change to `src/theme/tokens.ts` or the engine: a first attempt added a palette key, which broke a typed
fixture in another agent's test (`src/services/widgets/snapshot.test.ts`), so I reverted it and used the
existing `dangerDeep`. No existing test was edited or weakened. No existing test pinned the old error
colour or the old label caps.

## 7. Decisions for the main session

1. Fix 4: the no-value dash is now a hyphen, against the human's round-4 word. Keep or revert.
2. Range wording: the rule I used is "to" for ranges and "-" for no value. Apply it to the sites in 4a, then
   change the `it.failing` tests to `it()` and update the four assertions in `src/domain/edge.schedule.test.ts`.
3. Light error text is a little darker (fix 2). A visual change the human should see on the APK.
4. Toast structure (4c) needs a phone check before anyone changes it.
