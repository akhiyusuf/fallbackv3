# Design rebuild — saved preview work

The human asked to approve the look on the browser preview before the rebuild
goes to the pipeline agents. This folder holds that hand-built work so it
survives the session. Nothing here is shipped code; `src/**` and `app/**` in
this repo are unchanged.

## What is here

| Path | What it is |
|---|---|
| `design-rebuild.patch` | Every change to `src/` and `app/` (non-test files) that applies `docs/DESIGN_DECISIONS.md` to the app. Unified diff, `a/` = this repo, `b/` = rebuilt. |
| `preview-harness/` | The pieces that run the real app in a browser: `web-shims/` (native modules replaced for web), `metro.config.js`, `package.json`, `app.config.ts`, `previewBridge.ts` (goes in `src/`), `+not-found.tsx` (goes in `app/`), `page/` (inlines the bundle into one HTML file), and the build and screenshot scripts. |

## Apply the patch to a working copy

```sh
git apply --exclude=app/_layout.tsx --exclude=src/previewBridge.ts docs/design-rebuild/design-rebuild.patch
```

- `app/_layout.tsx` is excluded because the patch was cut from the preview
  copy, which also installs the preview bridge there. Apply that hunk by hand:
  it mounts `<AddMenuHost />`, `<CelebrationHost />` and `<Toast />` after the
  `<Stack>`.
- Two files are removed by the rebuild and show up as emptied in the patch:
  `src/features/assistant/AssistantHeader.tsx` and
  `src/features/progress/ProgressHeader.tsx`. Delete them.
- Test files are not in the patch. Many assert the old screens and will need
  updating by the owning feature-builder.

## Rebuild the browser preview

1. Copy the repo to a scratch folder, apply the patch, then copy
   `preview-harness/` over it (`previewBridge.ts` into `src/`, `+not-found.tsx`
   into `app/`, the rest at the root).
2. Add `installPreviewBridge(queryClient)` to `app/_layout.tsx`.
3. `npm install`, then `npx expo export --platform web`.
4. `python3 page/build.py <scratch>` writes the single-file preview.

`build.sh`, `v.js` and `sheet.js` are the type-check, screenshot and
contact-sheet helpers used while building; their paths point at the original
scratch folder and need editing.
