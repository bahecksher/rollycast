# 2026-07-17 2055 Guest appearance-propagation test

## TL;DR

- **What changed:** Added a guest-side assertion to `e2e/appearance.spec.ts` and a dev-only,
  production-stripped store hook in `apps/web/src/state/roomStore.ts` to observe it. No production
  behaviour changed.
- **Why:** The question was whether a host's table color/image change reaches other players. It does —
  but the existing e2e only checked the guest *lacked* host controls; it never verified the guest
  actually received the appearance. Closed that gap.
- **What didn't work:** N/A — no bug found. The feature was already correct end to end.
- **Next:** Nothing required. The commit is pushed to `main` but deliberately **not** deployed (no
  production diff; deploying would only risk the known open-tab-stranding).

---

## Full notes

### The question

"The host gets to change the colors — does that translate to the other players? And does the uploaded
picture reflect in the other players' views of the rolling surface?"

### What the code does (traced, confirmed correct)

- Host saves → `UPDATE_ROOM_SETTINGS` (requires the private host token) → server merges into
  `room.settings`, persists, and `broadcastMessage(ROOM_SETTINGS_UPDATED, { settings })` to **every**
  connection (no sender exclusion) — `apps/worker/src/server.ts:836-848`.
- Each client handles it with a plain `store().setSettings(...)` — no host check, because by then it is
  just room state — `apps/web/src/network/useRoomConnection.ts:164-166`.
- `DiceScene` reads `settings.appearance` and feeds it to the scene background and `DiceTable`
  (`apps/web/src/scene/DiceScene.tsx:39,69,74`). Host-gating is purely on the *write*.
- The uploaded image is resized/encoded to a JPEG **data URL in the host's browser before send**
  (`prepareBackgroundImage.ts`), so the bytes travel inside the message. Every client renders the same
  pre-processed image — no per-client processing to drift, no CDN/fetch to fail. This is also why the
  48,000-char cap exists (must fit under the 64 KiB message limit).
- Late joiners get the full appearance in the `ROOM_STATE` snapshot
  (`useRoomConnection.ts:129-133`).

### The test gap

`e2e/appearance.spec.ts` spawned a guest but only asserted `getByLabel('Host controls')` had count 0.
Every appearance assertion ran against the **host's own page**, including the post-reload check. So a
regression that stopped propagation to other players would not have failed the suite. (This mirrors a
mistake called out in the 2026-07-16 wrap-up: a green test that only exercised one party.)

### What I added

1. **Dev-only observation hook** — `roomStore.ts` now sets `window.__rollycastRoomStore = useRoomStore`
   guarded by `import.meta.env.DEV && typeof window !== 'undefined'`. Appearance only surfaces inside
   the WebGL canvas, so there is no DOM element to assert on for the guest; reading the store the scene
   renders from is the faithful, non-brittle signal (WebGL pixel readback would be flaky across the
   desktop and mobile projects, and fights `preserveDrawingBuffer: false`). Vite replaces
   `import.meta.env.DEV` with `false` in production and tree-shakes the block — verified the built JS
   chunk was unchanged (318.61 kB). The e2e runs against the Vite **dev** server, where DEV is true.
2. **Guest assertions** — after the host saves, the guest's `settings.appearance` must show
   `surfaceColor === '#345678'` and a `data:image/jpeg` `backgroundImage`, polled so it covers the live
   broadcast. Then the guest reloads (re-joins from stored identity) and the same must hold — covering
   the `ROOM_STATE` snapshot path for a non-host late joiner.

### Verification

All green: `typecheck`, `lint`, `format:check` (one long line in the spec reflowed by Prettier),
`build`, **105 unit tests** (78 shared + 16 web + 11 worker), and **22/22 Playwright** (11
desktop-chrome + 11 mobile-portrait). Note: the full suite reported 22 here vs. the previously-recorded
21 (10 mobile) — the appearance spec passes on mobile-portrait in this run. Did not investigate the old
count; the current run is clean on both projects.

### Deploy decision

Explicitly **not deployed**. The change is test-only plus a dev-stripped hook, so the production bundle
is functionally identical to what is live. Deploying would change nothing users see and would still
incur the known stale-chunk open-tab-stranding. Pushed to `main` on the user's instruction so the
coverage lands; deploy only alongside a real production change.
