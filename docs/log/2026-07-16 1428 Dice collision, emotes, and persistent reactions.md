# 2026-07-16 1428 Dice collision, emotes, and persistent reactions

## TL;DR

- **What changed:** Dice from different players now collide (other players' dice became kinematic
  physics bodies instead of ghost meshes). Dice emote when knocked into, broadcast to the room via a
  new `DIE_EMOTE` message. Roll reactions now persist on the roll record and are reachable and visible
  from the roll's own history row.
- **Why:** User asked for collision in the shared tray, dice with feelings about being knocked about
  ("for now, just use emotes"), and — mid-session — for reactions to work and show up in the same row
  as the roll.
- **What didn't work:** First-pass emote thresholds were guesses and were badly wrong — the floor sat
  below the median contact force, so dice emoted constantly and saturated the rate limiter exactly.
  Measured the real force distribution and retuned. Also took down the user's dev Worker mid-session
  by running Playwright against it.
- **Next:** Feel-check emote frequency/threshold on real hardware. Three pre-existing e2e specs are red
  from last session's tray change (stale selector) — noted in Known Issues, not fixed.

---

## Full notes

### The collision gap was narrower than it looked

Collision *within* a client's own dice already worked: every `RollingDie` is a real Rapier dynamic body
with a collider, and settled dice become kinematic obstacles. The only gap was `RemoteDie` — other
players' dice were plain visual `<group>`s with no physics, so cross-player dice passed through each
other.

Fix: wrap `RemoteDie` in a `kinematicPosition` RigidBody with the same collider, driven from the
existing network-target lerp via `setNextKinematicTranslation/Rotation` (not teleporting, so Rapier
derives a believable contact velocity rather than ejecting our dice). Kinematic keeps the throwing
client the sole authority over its own die. Results are untouched.

### Emotes

- Trigger: `onContactForce` on `RollingDie`, filtered to die-vs-die via rigid-body `userData`, above a
  force floor, with a per-die cooldown slightly longer than an emote's on-screen life so a die never
  interrupts its own reaction.
- Rendering: emoji sprites (three's `<sprite>` faces the camera for free) in a `DieEmoteLayer` that sits
  *outside* the physics bodies. This matters: a die tumbles, and a sprite parented to it would orbit the
  die instead of hovering above it. The layer re-reads each die's live position each frame from a new
  `dieTracker` position registry (refs, no per-frame re-render — same spirit as the existing transform
  streaming).
- Broadcast via new `DIE_EMOTE` client/server messages, own rate limit, silent drop when limited.

### Thresholds: guessed wrong, then measured

The first pass shipped `EMOTE_MIN_FORCE = 45`, `MEDIUM = 120`, `HEAVY = 320`. Driving two clients into a
12-dice pile-up showed 68 `DIE_EMOTE` frames — which is *exactly* the rate limiter's ceiling (2 players
× 10 burst + 4/s × ~6s). The limiter was shaping the feature instead of protecting it.

Probing actual contact forces over ~780 die-on-die contacts:

```
p10=4  p25=11  p50=74  p75=255  p90=738  p97=3152  max=16460
```

The floor of 45 sat below the median, so >50% of all contacts qualified, and "heavy" fired on ~a
quarter of them — every die maximally outraged, constantly. Retuned to floor 800 / medium 2500 /
heavy 7000. Same throw now produces 7 emotes, and the limiter is back to being a safety net.

### Reactions were not broken — they were unreachable and invisible

The pipeline (menu → `REACT_TO_ROLL` → server → `ROLL_REACTION` → toast) worked end-to-end. It felt
broken because:

- the only entry point was a nested "React ›" submenu behind a long-press/right-click on a die;
- dice are only interactive while `status === 'settled'`, and unkept dice expire after 30s — after
  which a roll in history could not be reacted to at all;
- the payoff was an 1800ms toast that was then discarded;
- `RollRecord` had no reactions field, so nothing survived a reconnect or reached a late joiner.

Changes: `reactions` on `rollRecordSchema` (optional, so previously-stored rolls still parse), server
appends/toggles and ships them in the snapshot, broadcast carries the roll's *full* reaction set (not a
delta, so a dropped message can't leave a row permanently wrong) plus a `removed` flag so taking a
reaction back doesn't fire a celebratory toast. Chips render inside the roll's own history row with a
`+` picker. Extracted `reactionCatalog.ts` because the reaction symbols were already duplicated in two
places and this needed a third.

Raised the `reaction` rate limit from 3/10s to 8/10s — stingy for a group table. This broke a worker
test that hardcoded the old capacity; rewrote it to derive from `RATE_LIMITS.reaction.capacity` so it
won't rot next retune, and extended it to cover persistence and toggling.

### Verification

- typecheck / lint / format / build clean; 104 unit tests pass (78 shared + 16 web + 10 worker), up
  from 97. New: emote catalog/threshold tests, emote rate-limit test, worker emote-relay test.
- New `e2e/reactions.spec.ts` passes: a reaction made on one client's history row appears on the other
  with correct "mine vs theirs" state, survives a reload, and toggles off for everyone.
- Drove two clients into a 12-dice pile-up: zero console/page errors, `DIE_EMOTE` frames confirmed on
  the wire, and screenshots show (a) six crimson + six gold dice resting side by side and stacked with
  no interpenetration — direct proof cross-player collision works — and (b) emote sprites rendering
  above the dice, camera-facing, readable, ~3 visible at once across 12 dice.

### Mishap worth recording

Playwright's `reuseExistingServer: !CI` attaches to a running dev server. The user had Vite up but not
the Worker, so Playwright *started* the Worker and tore it down on exit — which is why "create a table"
broke for the user mid-session while the page still loaded. Restarting `dev:worker` fixed it. With both
servers already running, Playwright reuses and tears down neither.

### Not done / disagreements

- Three e2e specs (`dice-local`, `full-room-flow`, `shared-roll`) are red from last session's floating
  hamburger tray: they click the Roll button without opening the tray first. Pre-existing (state.md
  noted e2e wasn't re-run), one-line fix each, left alone per the out-of-scope rule. Flagged to the user.
- Emote frequency and thresholds are measured but still subjective; awaiting a real feel-check.
