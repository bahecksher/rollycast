# State

_Last updated: 2026-07-16 1827_

**Live at https://rollycast.com** (Worker + assets, version `4d61cc41`). Deploying needs no new auth —
an existing `wrangler` OAuth session (bretthecksher@gmail.com, `workers (write)`) is in place, so
`npm run deploy` just works. `main` is pushed and the working tree is clean.

## Current focus

Character + cleanup pass, shipped. Dice from different players collide, dice emote when knocked about,
roll reactions persist and live on their history row, and the inspection panel is trimmed to one
surface with Reroll + Clear roll. The whole e2e suite is green for the first time, and the app is
deployed and verified in production.

## What's working

- M0–M9 remain implemented (authoritative rooms/rolls, complete dice set, history/inspection,
  accessible actions, ownership and linked/shared rerolls, keep/move/clear, reactions/fading, host
  appearance/settings, recovery, fallbacks, reduced motion, rate limits, performance controls, tests,
  deployment config).
- **Cross-player collision.** `RemoteDie` is a `kinematicPosition` body with the same collider,
  following streamed transforms via `setNextKinematic*`. Your dice collide with everyone else's while
  each client stays sole authority for its own dice's results. Verified visually in production.
- **Dice emotes.** Die-vs-die contacts above a force floor pop an emoji sprite that floats up and
  fades (`DieEmoteLayer` + `emoteTexture` + `dieTracker`), broadcast via `DIE_EMOTE` with its own
  silently-dropping rate limit. Fires on *any* die hitting *any* die, including your own. Cosmetic and
  never recorded. Floor 250 / medium 450 / heavy 1,000 → ~2.5 emotes per throw.
- **Roll reactions.** Stored on `RollRecord`, so they survive reconnects and reach late joiners.
  Toggle off when re-sent. Chips + `+` picker on the roll's own history row, and a reaction row in the
  panel. Broadcasts carry the full reaction set, so a dropped message can't leave a row wrong.
- **Inspection panel.** One surface: roll summary, then the die's actions (**Reroll**, **Clear roll**)
  and reactions inline. The right-click/long-press popup remains the fast path on the 3D die; both
  build from one `dieActionsFor` helper.
- **Inspected dice stay put.** A client re-sends `KEEP_ROLL_ALIVE` every 10s while a roll is
  inspected; the server extends that roll's unkept dice and broadcasts `ROLL_EXPIRY_EXTENDED`. Stops
  on close, so dice resume their countdown.
- **Deploys no longer break open tabs.** A failed 3D-scene import reloads once to pick up the new
  build (`e2e/stale-build.spec.ts`).
- Verification: `typecheck`, `lint`, `format:check`, `build`, **105 unit tests** (78 shared + 16 web +
  11 worker), and **11/11 desktop-chrome + 10/10 mobile-portrait** Playwright.

## In progress

Nothing mid-change. Clean stopping point.

## Known issues

- **Multi-die rolls don't show individual dice values in the panel.** The per-die chips and the
  "d20 showing 15" label were both removed as duplicative, so a 2d20 shows only the expression and
  total, and nothing indicates *which* die Reroll applies to (the one you clicked, or the first if
  opened from History). History rows still show `[14, 4]`.
- **Keep / move / multi-select are unreachable from the UI** but fully present in state, protocol and
  server (`SET_DIE_KEPT`, move grabs, `beginMultiSelect`). Dead paths, not dead code.
- **Emotes are disabled entirely under reduced motion.** Expected, but a plausible "why don't I see
  emotes" cause.
- **Emote frequency is subjective.** ~2.5/throw, measured for 2- and 6-die throws. Heavy emotes
  (😡/🤕) need a genuine slam and stay rare.
- **Deploys can strand open tabs.** Missing assets return `index.html` with a 200 (SPA fallback), not
  a 404, so an open tab importing an old hashed chunk parses HTML as JS. Mitigated by the reload
  recovery; the underlying behaviour is unchanged (see docs/decisions.md for why).
- **Wire compatibility during a deploy window.** `ROLL_REACTION` gained two required fields, so a new
  server's reaction messages are dropped by an old open tab until it reloads. `PROTOCOL_VERSION`
  deliberately stays at 1 — bumping it would make old tabs reject *every* message instead.
- **Clients disagree slightly on cross-player bounce visuals.** Each client simulates its own dice
  against kinematic ghosts of the rest. Deliberate — see docs/decisions.md.
- **Playwright can kill a dev server you started.** `reuseExistingServer: !CI` means it tears down any
  server *it* had to start. Have `dev:worker` and `dev:web` both up before an e2e run.
- **History event rows (name/color changes) are client-side only** and vanish on reconnect. (Roll
  reactions are now persisted; these event rows are not.)
- **New default board colors apply to new rooms only.** Existing rooms keep their stored appearance
  until a host does Reset → Save.
- Physics-authoritative results remain a deliberate reversal of the spec's server-authoritative
  requirement (docs/decisions.md).
- On mobile portrait the inspection panel overlays the lower ~half of the canvas — slightly better
  than earlier today now the label and chips are gone, but still overlapping.
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

- Open two browsers on one room. Throw dice from both at once: they should knock into each other
  rather than pass through, and dice taking a real knock pop an emoji both players see.
- Open History, click `+` on a roll's row, pick a reaction: a chip appears in that row on every
  client. Click your own chip to remove it. Reload — the chip is still there.
- Click a die: the panel shows the roll, Reroll / Clear roll, and reactions in one surface. Leave it
  inspected for a minute — the die must not disappear; close the panel and it goes ~30s later.
- Full suite: `npm run typecheck && npm test && npm run lint && npm run format:check && npm run build`.
- E2E: `npx playwright test` — 11/11 desktop-chrome, 10/10 mobile-portrait. Start both dev servers
  first (see Known issues).
- Deploy: `npm run deploy`.

## Recent logs

- docs/log/2026-07-16 1827 Session wrap-up.md — what shipped this session, plus three mistakes worth
  carrying forward (tuning to the wrong scenario twice; a green production test that only tested fresh
  visitors; reverting the user's tree under a live dev server).
- docs/log/2026-07-16 1557 Green e2e suite and first live deploy.md — fixed all five red e2e specs,
  dropped the duplicate die label, deployed to rollycast.com; addendum covers the stale-chunk bug that
  broke open tabs after the first deploy and its reload fix.
- docs/log/2026-07-16 1509 Trim die actions, fix emote threshold, hold inspected dice.md — actions cut
  to Reroll + Clear roll; emotes were unreachable (floor 800 vs a 2-die max of ~505) and are now tuned
  to the common case; inspected rolls held on the table via a keep-alive.
- docs/log/2026-07-16 1448 Inspection panel - inline die actions.md — removed the redundant "Actions
  for selected die" button; the panel carries the die's actions and reactions inline, and it and the
  popup menu share one `dieActionsFor` definition.
- docs/log/2026-07-16 1428 Dice collision, emotes, and persistent reactions.md — remote dice became
  kinematic bodies so cross-player dice collide; die-vs-die emotes broadcast room-wide with measured
  force thresholds; roll reactions persisted and surfaced as chips in the history row.
- docs/log/2026-07-16 0136 Usability pass - controls, colors, history, rename.md — top-bar player
  controls, orange theme + new board colors, zoom, floating hamburger tray, off-table fall-away,
  color-tinted history + event rows, rename to RollyCast.
