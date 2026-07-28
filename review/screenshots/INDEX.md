# Visual QA — Fallback
**Status: Cannot render — environment limitation (see README.md)**

| Screen | Route | Description | Mobile | Desktop | Notes |
|---|---|---|---|---|---|
| S01 | `/splash` | Splash screen | ❌ | ❌ | Web rendering unavailable (react-dom/react-native-web not in dependencies) |
| S02 | `/onboarding/hook` | Onboarding: Hook | ❌ | ❌ | — |
| S03 | `/onboarding/concept` | Onboarding: Concept | ❌ | ❌ | — |
| S04 | `/onboarding/types` | Onboarding: Types | ❌ | ❌ | — |
| S05 | `/onboarding/consistency` | Onboarding: Consistency | ❌ | ❌ | — |
| S06 | `/onboarding/personalize` | Onboarding: Personalize | ❌ | ❌ | — |
| S07 | `/onboarding/notifications-primer` | Onboarding: Notifications primer | ❌ | ❌ | — |
| S08 | `/onboarding/first-task` | Onboarding: First task | ❌ | ❌ | — |
| S09 | `/(tabs)/today` | Today | ❌ | ❌ | — |
| S10 | `/(tabs)/routines` | Routines browse | ❌ | ❌ | — |
| S11 | `/(tabs)/events` | Events browse | ❌ | ❌ | — |
| S12 | `/(tabs)/courses` | Courses browse | ❌ | ❌ | — |
| S13 | `/(tabs)/todos` | To-dos browse | ❌ | ❌ | — |
| S14 | `/search` | Search | ❌ | ❌ | — |
| S15 | `/add/index` | Add task (base) | ❌ | ❌ | — |
| S16 | `/add/routine` | Add routine | ❌ | ❌ | — |
| S17 | `/add/event` | Add event | ❌ | ❌ | — |
| S18 | `/add/course` | Add course | ❌ | ❌ | — |
| S19 | `/add/todo` | Add to-do | ❌ | ❌ | — |
| S20 | `/task/[id]/index` | Task manage sheet | ❌ | ❌ | — |
| S21 | `/task/[id]/icon` | Task icon picker | ❌ | ❌ | — |
| S22 | `/task/[id]/delete` | Task delete confirm | ❌ | ❌ | — |
| S23 | `/task/[id]/as-needed` | As-needed history | ❌ | ❌ | — |
| S24 | `/task/[id]/celebrate` | Completion celebration | ❌ | ❌ | — |
| S25 | `/progress/index` | Progress / Dashboard | ❌ | ❌ | — |
| S26 | `/progress/trend` | Trend graph | ❌ | ❌ | — |
| S27 | `/achievements/index` | Achievements | ❌ | ❌ | — |
| S28 | `/achievements/celebrate` | Achievement celebration | ❌ | ❌ | — |
| S29 | `/records/index` | Records / Cycles | ❌ | ❌ | — |
| S30 | `/records/[cycleId]` | Cycle detail | ❌ | ❌ | — |
| S31 | `/assistant/index` | Assistant intro | ❌ | ❌ | — |
| S32 | `/assistant/chat` | Assistant chat | ❌ | ❌ | — |
| S33 | (modal) | Clarification modal | ❌ | ❌ | Modal, no route |
| S34 | `/assistant/history/index` | Conversation history list | ❌ | ❌ | — |
| S35 | `/assistant/history/[id]` | Conversation detail | ❌ | ❌ | — |
| S36 | (sheet) | Voice & language options | ❌ | ❌ | Sheet, no route |
| S37 | `/assistant/mic-primer` | Microphone primer | ❌ | ❌ | — |
| S38 | `/assistant/paywall/index` | Assistant paywall | ❌ | ❌ | — |
| S39 | `/assistant/paywall/plan` | Plan selector | ❌ | ❌ | — |
| S40 | `/assistant/paywall/byo` | Bring your own key | ❌ | ❌ | — |
| S41 | `/settings/index` | Settings | ❌ | ❌ | — |
| S42 | `/settings/notifications` | Notification settings | ❌ | ❌ | — |
| S43 | `/settings/theme` | Theme & accent settings | ❌ | ❌ | — |
| S44 | `/settings/subscription` | Subscription | ❌ | ❌ | — |
| S45 | `/settings/sync` | Cloud sync settings | ❌ | ❌ | — |
| S46 | `/settings/widgets` | Widget settings | ❌ | ❌ | — |
| S47 | `/settings/data/index` | Data settings | ❌ | ❌ | — |
| S48 | `/settings/data/erase` | Erase all confirm | ❌ | ❌ | — |
| S49 | `/settings/help` | Help & support | ❌ | ❌ | — |
| S50 | `/recovery` | Data recovery | ❌ | ❌ | — |

## Summary

**Total screens:** 50
**Captured at mobile (390×844):** 0
**Captured at desktop (1440×900):** 0

## Environment Notes

- **Build status:** ✓ Complete (all 8 modules + architect CRs at PASS code review)
- **Unit tests:** ✓ 697 passing (99 suites)
- **TypeScript:** ✓ Clean (zero errors)
- **Acceptance criteria:** ✓ Traced and verified via static analysis + test suite

**Cannot proceed:** This is a React Native app, not a web app. Headless Expo web rendering requires npm dependencies (`react-dom`, `react-native-web`) that are not installed and cannot be added per pipeline rules (dependency additions require an architect change request). iOS Simulator, Android Emulator, and physical devices are not available in this environment.

**For Gate 3:** The human must boot the app locally (`npx expo start` on their own machine) to visually verify all 50 screens against the approved design specs (see `design-input/` for reference mockups and design tokens). The build is complete and tested; only the visual rendering is environment-dependent.
