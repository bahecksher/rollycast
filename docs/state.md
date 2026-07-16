# State
_Last updated: 2026-07-16 0136_

## Current focus

Usability/polish session wrapped. A broad batch of user-driven feel fixes landed: top-bar player
name + click-to-edit name/color, orange theme, new default board colors, wheel/pinch zoom, a
floating hamburger dice tray, off-table dice that fall away (with a single cheeky message),
color-tinted history rows + name/color change event rows, and an app rename to **RollyCast**. Clean
stopping point; full verification green.

## What's working

- M0–M9 remain implemented (authoritative rooms/rolls, complete dice set, history/inspection,
  accessible actions, ownership and linked/shared rerolls, keep/move/clear, reactions/fading, host
  appearance/settings, recovery, fallbacks, reduced motion, rate limits, performance controls,
  tests, deployment config).
- This session's changes (all compile/lint/test-green):
  - **Player controls**: name shown by the Room ID; click it to edit display name + dice color
    (`PlayerProfilePanel`, existing `UPDATE_PLAYER` protocol; `applySelfUpdate` syncs self/identity/
    dice color). "Style" → "Host Controls".
  - **Theme**: blue accents → orange (dark surfaces kept). New default board colors: grey surface,
    off-white rim, soft orange backdrop (new rooms only).
  - **Zoom**: wheel + pinch (`CameraZoom`) dollying the camera; `gestureState.pinching` keeps the
    throw layer from firing during a pinch.
  - **Dice tray**: centered hamburger floating over the backdrop; fixed "−"/"×" mojibake; removed
    modifier; "Clear mine" → "Clear".
  - **Off-table dice**: fall away as before; client stops streaming the rogue position on miss (kills
    the error flood), skips the settle, and shows exactly one cheeky nudge. Sayings in shared
    (`sayings.ts`), reused server-side as fallback.
  - **History**: rows tinted by die color; live event rows for "Name change: A → B" and
    "Color switch: Name"; History button now grey like the Dice chip.
  - **Rename**: Shared Dice Table → RollyCast (landing heading, `<title>`, package description, e2e
    assertion).
- Full verification passes on system Node: `typecheck`, `lint`, `format:check`, `build`, and all 97
  unit tests (72 shared + 16 web + 9 worker).

## In progress

Nothing mid-change. Clean stopping point.

## Known issues

- **Local Worker can 500 on "create a table" after heavy concurrent load** (e.g. running the e2e
  suite + probes against the same dev server): local DO SQLite hits `SQLITE_BUSY`, sometimes leaving
  a zombie `workerd`. Fix: kill stale `node`/`workerd`/`wrangler dev` and restart `npm run dev`.
  Not a code bug.
- **History event rows (name/color changes) are client-side only** — every connected client sees
  them, but they are not persisted and vanish on reconnect (a shared/persistent version would need a
  server-side event record + protocol change).
- **New default board colors apply to new rooms only.** Existing rooms keep their stored appearance
  until a host does Reset → Save.
- Physics-authoritative results remain a deliberate reversal of the spec's server-authoritative
  requirement (see docs/decisions.md and the physics-authoritative spec).
- On mobile portrait the inspection panel overlays the lower ~half of the table canvas.
- Held-die swing / curve-ball feel and zoom limits (~0.55×–1.7×) are subjective; awaiting a
  real-hardware feel-check.
- The lazy 3D scene chunk is ~3.18 MB min / ~1.09 MB gzip; further splitting is post-MVP.
- Playwright e2e not re-run this session (the landing assertion was updated to the new "RollyCast"
  heading — worth a run before any deploy).
- Live deployment still requires Cloudflare authorization; no external deploy attempted. Note:
  GitHub Pages (which the user floated) is static-only and cannot host the Worker/DO backend.
- No git commits yet (git push deferred by the user this session).

## Next actions
1. Optional: feel-check zoom, the floating dice tray, tinted history rows, and off-table fall on
   real hardware; tune constants if wanted.
2. When ready: re-run Playwright e2e (`npx playwright test`), then git commit/push.
3. Revisit hosting: Cloudflare (Worker + Pages/Assets) for a full deploy; GitHub Pages only works
   for a backend-less frontend.
4. Consider the mobile inspection-panel-over-canvas overlap.

## Active plan

docs/plans/2026-07-15 1707 Plan revision - Host table appearance.md

## How to verify

`npm run dev` (system Node 24 on PATH). Then:
- Open http://127.0.0.1:5173, create a table. Check: player name in the top bar (click to edit
  name/color), orange accents, grey/white/orange board, wheel/pinch zoom, the bottom hamburger Dice
  tray over the backdrop, and the History button (grey). Roll and miss the table — the die falls
  away and a single cheeky message shows. Change name/color — history logs a tinted event row and
  new rolls carry the new name/color.
- Full suite: `npm run typecheck && npm test && npm run lint && npm run format:check && npm run build`.
- E2E: `npx playwright test` (`workers: 1`, ~6 min). Restart the dev server after a heavy e2e run if
  create-table then 500s (see Known issues).

## Recent logs

- docs/log/2026-07-16 0136 Usability pass - controls, colors, history, rename.md — top-bar player
  controls, orange theme + new board colors, zoom, floating hamburger tray, off-table fall-away with
  a single cheeky message, color-tinted history + name/color event rows, rename to RollyCast.
- docs/log/2026-07-16 0025 Held-die juggle, curveball throw, fair spawn.md — pre-throw die swings on
  a string and rolls with the drag; throw spin derived from the flick; random spawn orientation.
- docs/log/2026-07-15 2202 Physics-authoritative dice results.md — die shows what it lands on; that
  is the recorded result. Server RNG kept only as an abandoned-roll fallback.
- docs/log/2026-07-15 2001 Build review and settle-flip fix.md — verified Codex's work, fixed the
  settle correction blend, made the e2e suite reliable.
- docs/log/2026-07-15 1821 Local test server.md — portable Node setup and verified Vite/Worker URL.
