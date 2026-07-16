# State
_Last updated: 2026-07-16 1509_

## Current focus

Character + cleanup pass. Cross-player dice collision, dice that emote when knocked about, roll
reactions that persist and show inline in their history row, and a heavily trimmed inspection panel
(Reroll + Clear roll only, actions inline, no second popup). Emote thresholds were retuned twice and
are now measured against an ordinary throw. Inspected dice are held on the table instead of being swept
mid-read. Clean stopping point; full verification green.

## What's working

- M0–M9 remain implemented (authoritative rooms/rolls, complete dice set, history/inspection,
  accessible actions, ownership and linked/shared rerolls, keep/move/clear, reactions/fading, host
  appearance/settings, recovery, fallbacks, reduced motion, rate limits, performance controls,
  tests, deployment config).
- Previous session's usability batch (top-bar player name/color editing, orange theme, new board
  colors, wheel/pinch zoom, floating hamburger dice tray, off-table fall-away, tinted history rows,
  rename to RollyCast) all still in place.
- This session's changes (all compile/lint/test-green, and verified in the running app):
  - **Cross-player collision**: `RemoteDie` is now a `kinematicPosition` body with the same collider,
    following streamed transforms via `setNextKinematic*`. Your dice collide with everyone else's;
    each client stays sole authority for its own dice's results. Verified visually — 6 crimson + 6
    gold dice rest side by side and stacked, no interpenetration.
  - **Dice emotes**: die-vs-die contacts above a force floor pop an emoji sprite above the die that
    floats up and fades (`DieEmoteLayer` + `emoteTexture` + `dieTracker`). Fires on *any* die hitting
    *any* die, including your own. Broadcast room-wide via a new `DIE_EMOTE` message with its own rate
    limit that drops silently. Cosmetic only — never recorded. Thresholds (floor 250 / medium 450 /
    heavy 1,000) measured against an ordinary 2-die throw: ~2.5 emotes per throw, and the same for a
    6-die throw, bound by the per-die cooldown rather than the rate limiter.
  - **Roll reactions fixed**: now stored on `RollRecord` (survive reconnects, reach late joiners),
    toggle off when re-sent, and reachable from the roll's own history row via chips + a `+` picker.
    Broadcast carries the full reaction set so a dropped message can't leave a row wrong. Reaction
    rate limit raised 3/10s → 8/10s.
  - **Inspection panel de-duplicated and trimmed**: "Actions for selected die" (which opened a second
    popup on top of the panel) is gone; the panel shows the die's actions and a reaction row inline.
    Actions are now just **Reroll** and **Clear roll** — "Select more dice", "Keep die", "Move die",
    the Modifier row, and the per-die result chips were all removed at the user's request. The
    right-click/long-press popup stays as the fast path on the 3D die. Both build their action list
    from one `dieActionsFor` helper, so permission rules can't drift between them.
  - **Inspected dice stay put**: a client re-sends `KEEP_ROLL_ALIVE` every 10s while it has a roll
    inspected; the server pushes that roll's unkept dice out a full lifetime and broadcasts
    `ROLL_EXPIRY_EXTENDED` so every client's fade agrees. Stops on close, so dice resume their
    countdown. Verified: inspected die survives 40s; expires ~35s after deselect.
- Full verification passes on system Node: `typecheck`, `lint`, `format:check`, `build`, and all 104
  unit tests (78 shared + 16 web + 10 worker). `e2e/reactions.spec.ts` passes.

## In progress

Nothing mid-change. Clean stopping point.

## Known issues

- **Three e2e specs are red, pre-existing**: `dice-local`, `full-room-flow`, and `shared-roll` click the
  Roll button without opening the floating "Dice" tray that last session put it behind. One-line fix
  each (`await page.locator('.dock-menu-toggle').click()`); left alone as out of scope this session.
  `landing`, `appearance`, `presence`, `complete-dice` not re-checked.
- **Multi-die rolls no longer show individual dice values in the panel.** Removing the per-die result
  chips means a 2d20 shows the total and only the *selected* die's face; History rows still show
  `[14, 4]`. Chips could come back for multi-die rolls only if wanted.
- **Multi-select / keep / move are unreachable from the UI** but still fully present in state, protocol,
  and the server (`SET_DIE_KEPT`, move grabs, `beginMultiSelect` and friends). Dead paths, not dead
  code — worth a decision on whether to rip them out.
- **Emotes are disabled entirely under reduced motion** (`onEmote` is not wired when
  `prefers-reduced-motion` is set). Expected, but a plausible "why don't I see emotes" cause.
- **Emote frequency is subjective.** ~2.5 per throw at floor 250 / medium 450 / heavy 1,000, measured
  for both 2- and 6-die throws. Heavy emotes (😡/🤕) need a genuine slam and stay rare in normal play.
- **Clients disagree slightly on cross-player bounce visuals.** Each client simulates its own dice
  against kinematic ghosts of everyone else's, so the exact bounce differs per screen. Deliberate — see
  docs/decisions.md.
- **Running Playwright can kill a dev server you started.** `reuseExistingServer: !CI` means Playwright
  tears down any server *it* had to start. Have both `dev:worker` and `dev:web` up before an e2e run,
  or expect "create a table" to break afterwards.
- **History event rows (name/color changes) are still client-side only** — every connected client sees
  them, but they are not persisted and vanish on reconnect. (Roll *reactions* are now persisted; these
  event rows are not.)
- **New default board colors apply to new rooms only.** Existing rooms keep their stored appearance
  until a host does Reset → Save.
- Physics-authoritative results remain a deliberate reversal of the spec's server-authoritative
  requirement (see docs/decisions.md and the physics-authoritative spec).
- On mobile portrait the inspection panel overlays the lower ~half of the table canvas — now slightly
  worse, since the panel absorbed the die actions that used to live in a popup.
- Held-die swing / curve-ball feel and zoom limits (~0.55×–1.7×) are subjective; awaiting a
  real-hardware feel-check.
- The lazy 3D scene chunk is ~3.18 MB min / ~1.09 MB gzip; further splitting is post-MVP.
- Live deployment still requires Cloudflare authorization; no external deploy attempted. Note:
  GitHub Pages (which the user floated) is static-only and cannot host the Worker/DO backend.
- No git commits yet (git push deferred by the user in the previous session).

## Next actions
1. Feel-check on real hardware: emote frequency (~2.5/throw now) and how collision reads with 2+
   players throwing at once. Tune `EMOTE_MIN_FORCE` / `EMOTE_COOLDOWN_MS` (RollingDie) and
   `MEDIUM_IMPACT` / `HEAVY_IMPACT` (shared/emotes.ts) if wanted.
2. Decide whether multi-die rolls need their per-die values back in the panel.
3. Decide on the three stale e2e specs — one-line tray-open fix each.
4. Decide whether to remove the now-unreachable keep/move/multi-select machinery.
5. When ready: full `npx playwright test`, then git commit/push.
6. Revisit hosting: Cloudflare (Worker + Pages/Assets) for a full deploy.

## Active plan

docs/plans/2026-07-16 1402 Plan - Dice collision, emotes, and persistent reactions.md

## How to verify

`npm run dev` (system Node 24 on PATH). Then:
- Open two browsers on the same room. Throw a handful of dice from both at once: they should knock into
  each other rather than pass through, and dice that take a real knock pop an emoji that both players
  see.
- Open History, click `+` on a roll's row, pick a reaction: a chip appears in that same row on every
  client. Click your own chip to remove it. Reload — the chip is still there.
- Click a die: the inspection panel shows the roll, Reroll / Clear roll, and a reaction row in one
  surface. Right-click a die for the popup menu. Leave it inspected for a minute — the die must not
  disappear; close the panel and it should vanish ~30s later.
- Throw 2 dice: they should knock into each other and emote roughly a couple of times per throw.
- Full suite: `npm run typecheck && npm test && npm run lint && npm run format:check && npm run build`.
- E2E: `npx playwright test e2e/reactions.spec.ts` passes. The full suite has three pre-existing
  failures (see Known issues). Start both dev servers before running, or Playwright will tear down the
  Worker it started and "create a table" will 000 afterwards.

## Recent logs

- docs/log/2026-07-16 1509 Trim die actions, fix emote threshold, hold inspected dice.md — actions cut
  to Reroll + Clear roll; emotes were unreachable (floor 800 vs a 2-die max of ~505) and are now tuned
  to the common case; inspected rolls held on the table via a keep-alive.
- docs/log/2026-07-16 1448 Inspection panel - inline die actions.md — removed the redundant "Actions
  for selected die" button; the panel now carries the die's actions and reactions inline, and both it
  and the popup menu share one `dieActionsFor` definition.
- docs/log/2026-07-16 1428 Dice collision, emotes, and persistent reactions.md — remote dice became
  kinematic bodies so cross-player dice collide; die-vs-die emotes broadcast room-wide with measured
  force thresholds; roll reactions persisted on the roll record and surfaced as chips in the history row.
- docs/log/2026-07-16 0136 Usability pass - controls, colors, history, rename.md — top-bar player
  controls, orange theme + new board colors, zoom, floating hamburger tray, off-table fall-away with
  a single cheeky message, color-tinted history + name/color event rows, rename to RollyCast.
- docs/log/2026-07-16 0025 Held-die juggle, curveball throw, fair spawn.md — pre-throw die swings on
  a string and rolls with the drag; throw spin derived from the flick; random spawn orientation.
- docs/log/2026-07-15 2202 Physics-authoritative dice results.md — die shows what it lands on; that
  is the recorded result. Server RNG kept only as an abandoned-roll fallback.
- docs/log/2026-07-15 2001 Build review and settle-flip fix.md — verified Codex's work, fixed the
  settle correction blend, made the e2e suite reliable.
