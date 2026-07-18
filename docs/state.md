# State

_Last updated: 2026-07-17 2055_

**Live at https://rollycast.com** (Worker + assets, version `4d61cc41`). Deploying needs no new auth —
an existing `wrangler` OAuth session (bretthecksher@gmail.com, `workers (write)`) is in place, so
`npm run deploy` just works. **`main` is pushed but this latest commit is not deployed** (a test-only
change with no production diff — see below); the working tree is clean.

## Current focus

Closed a test gap around host appearance propagation. The investigation confirmed the feature already
works: when the host changes table colors or uploads a surface image, the change reaches every other
player live and reaches late joiners through the room snapshot. No product bug was found and no
production code changed — the only shipping-relevant artifact is a stronger e2e test.

## What's working

- M0–M9 remain implemented (authoritative rooms/rolls, complete dice set, history/inspection,
  accessible actions, ownership and linked/shared rerolls, keep/move/clear, reactions/fading, host
  appearance/settings, recovery, fallbacks, reduced motion, rate limits, performance controls, tests,
  deployment config).
- **Host appearance propagates to everyone — now covered by test.** `UPDATE_ROOM_SETTINGS` (host token
  required) → server merges + persists + `broadcastMessage(ROOM_SETTINGS_UPDATED)` to all connections
  → each client's `setSettings` → `DiceScene` renders `settings.appearance` for the background and
  `DiceTable`. The uploaded image is encoded to a JPEG data URL in the host's browser *before* send, so
  the bytes travel in the message and every client shows the identical image; late joiners get it in
  `ROOM_STATE`. `e2e/appearance.spec.ts` now asserts a **guest** receives the host's surface color and
  image both live and after a guest reload (the snapshot path), not just that the guest lacks host
  controls.
- **Dev-only test hook.** `roomStore.ts` exposes `window.__rollycastRoomStore` under
  `import.meta.env.DEV` only. Vite statically strips this from production builds (verified: built JS
  chunk unchanged at 318.61 kB). It exists so e2e can read applied room state that only surfaces inside
  the WebGL canvas.
- Cross-player collision, dice emotes, persisted roll reactions, one-surface inspection panel, and the
  inspected-dice keep-alive all remain as delivered (see prior logs). Deploys recover open tabs via a
  one-time reload on a failed 3D-scene import.
- Verification (all green this session): `typecheck`, `lint`, `format:check`, `build`, **105 unit
  tests** (78 shared + 16 web + 11 worker), and **22/22 Playwright (11 desktop-chrome + 11
  mobile-portrait)**. Note: the mobile count is 11 here; earlier state recorded 10 — the appearance
  spec passes on mobile-portrait in this run.

## In progress

Nothing mid-change. Latest commit pushed but not deployed; clean stopping point.

## Known issues

- **The latest commit has no production effect.** It is a test plus a dev-stripped hook — pushed to
  `main` but not deployed. Deploying it would not change anything users see and would still incur the
  open-tab-stranding cost below, so it was deliberately left undeployed. Deploy only alongside a real
  production change.
- **Multi-die rolls don't show individual dice values in the panel.** A 2d20 shows only the expression
  and total, and nothing indicates which die Reroll applies to. History rows still show `[14, 4]`.
- **Keep / move / multi-select are unreachable from the UI** but fully present in state, protocol and
  server. Dead paths, not dead code.
- **Emotes are disabled entirely under reduced motion.** Expected, but a plausible "why don't I see
  emotes" cause.
- **Emote frequency is subjective.** ~2.5/throw. Heavy emotes (😡/🤕) need a genuine slam and stay rare.
- **Deploys can strand open tabs.** Missing assets return `index.html` with a 200 (SPA fallback), so an
  open tab importing an old hashed chunk parses HTML as JS. Mitigated by the reload recovery; the
  underlying behaviour is unchanged (see docs/decisions.md).
- **Wire compatibility during a deploy window.** `ROLL_REACTION` gained two required fields, so a new
  server's reaction messages are dropped by an old open tab until it reloads. `PROTOCOL_VERSION`
  deliberately stays at 1.
- **Clients disagree slightly on cross-player bounce visuals.** Deliberate — see docs/decisions.md.
- **Playwright can kill a dev server you started.** `reuseExistingServer: !CI` tears down any server
  *it* had to start. Letting Playwright own both servers for a single run is self-contained and fine.
- **History event rows (name/color changes) are client-side only** and vanish on reconnect. (Roll
  reactions are persisted; these event rows are not.)
- **New default board colors apply to new rooms only.** Existing rooms keep their stored appearance
  until a host does Reset → Save.
- Physics-authoritative results remain a deliberate reversal of the spec's server-authoritative
  requirement (docs/decisions.md).
- On mobile portrait the inspection panel overlays the lower ~half of the canvas.
- The lazy 3D scene chunk is ~3.18 MB min / ~1.09 MB gzip; further splitting is post-MVP.
- GitHub Pages cannot host this — the Worker/DO backend needs Cloudflare.

## Next actions

1. Feel-check on the live site: emote frequency and how collision reads with 2+ players throwing at
   once. Tune `EMOTE_MIN_FORCE` / `EMOTE_COOLDOWN_MS` (RollingDie) and `MEDIUM_IMPACT` /
   `HEAVY_IMPACT` (shared/emotes.ts) if wanted.
2. Decide whether multi-die rolls need their per-die values back in the panel.
3. Decide whether to remove the unreachable keep/move/multi-select machinery.
4. Consider the mobile inspection-panel-over-canvas overlap.

## Active plan

docs/plans/2026-07-16 1402 Plan - Dice collision, emotes, and persistent reactions.md (delivered)

## How to verify

`npm run dev` (system Node 24 on PATH), or use https://rollycast.com. Then:

- Open two browsers on one room. As host, open Host controls, change the surface color and upload an
  image, Save. The other browser's table must update live to the same color/image. Reload the guest —
  it still shows them (snapshot path).
- Full suite: `npm run typecheck && npm test && npm run lint && npm run format:check && npm run build`.
- E2E: `npx playwright test` — 22/22 (11 desktop-chrome, 11 mobile-portrait). Letting Playwright start
  both dev servers for the run is fine; it tears down only servers it started.
- Deploy (only with a real production change): `npm run deploy`.

## Recent logs

- docs/log/2026-07-17 2055 Guest appearance-propagation test.md — confirmed host color/image changes
  already reach other players and late joiners; added a guest-side e2e assertion (live + after reload)
  and a dev-only, prod-stripped store hook to observe it; full suite green; deliberately not deployed
  because there is no production diff.
- docs/log/2026-07-16 1827 Session wrap-up.md — what shipped that session, plus three mistakes worth
  carrying forward.
- docs/log/2026-07-16 1557 Green e2e suite and first live deploy.md — fixed all five red e2e specs,
  dropped the duplicate die label, deployed to rollycast.com; addendum covers the stale-chunk bug.
- docs/log/2026-07-16 1509 Trim die actions, fix emote threshold, hold inspected dice.md — actions cut
  to Reroll + Clear roll; emotes tuned to the common case; inspected rolls held via a keep-alive.
- docs/log/2026-07-16 1448 Inspection panel - inline die actions.md — panel carries the die's actions
  and reactions inline; shares one `dieActionsFor` definition with the popup menu.
