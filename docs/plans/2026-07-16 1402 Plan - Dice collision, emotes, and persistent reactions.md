# Plan - Dice collision, emotes, and persistent reactions
_Created: 2026-07-16 1402_

## Goal

Give the table more character, in three user-requested pieces:

1. **Cross-player dice collision.** Everyone throws into the same tray, so dice should knock into each
   other regardless of who threw them.
2. **Collision emotes.** When a die gets knocked about it reacts with an emote, as if it has feelings
   about it. Broadcast so everyone sees the same reaction.
3. **Roll reactions that work and persist.** Reacting to a roll is currently unreachable and
   invisible. Make it reachable from the history row, and show the reactions inline in that same row.

## Findings that shape the approach

- Collision *within* one client's own dice already works: every `RollingDie` is a real Rapier dynamic
  body with a collider, and settled dice become kinematic obstacles. The only gap is `RemoteDie`,
  which is a plain visual `<group>` with no physics — so other players' dice are ghosts.
- The reaction pipeline (menu → `REACT_TO_ROLL` → server → `ROLL_REACTION` → toast) is wired
  end-to-end and works. It *feels* broken because:
  - the only entry point is a nested submenu behind a long-press/right-click on a die;
  - dice are only interactive while `status === 'settled'`, and unkept dice expire after 30s, after
    which a roll in history can no longer be reacted to at all;
  - the result is a 1800ms toast that is then discarded.
- `RollRecord` has no `reactions` field. Reactions are fire-and-forget broadcasts, so they cannot
  survive a reconnect or reach a late joiner. Persisting them is required for "show up in history".
- The `reaction` rate limit is 3 per 10s per player — appropriate for a button, far too tight for
  collision emotes. Emotes need their own message type and limit.

## Approach

### A. Cross-player collision

Wrap `RemoteDie` in a `kinematicPosition` RigidBody carrying the same collider `RollingDie` uses
(from `getDieDefinition`). Keep the existing network-target lerp, but drive it through
`setNextKinematicTranslation` / `setNextKinematicRotation` so Rapier derives contact velocity properly
instead of teleporting the body.

Result: each client's own dice (dynamic) collide against every other player's dice (kinematic ghosts),
and the same happens mirrored on their screen. Each client stays the sole authority for its own dice's
results, so the physics-authoritative decision in `docs/decisions.md` is untouched — only the visual
bounce differs slightly between screens, which is the same class of trade-off already accepted there.

Tag each die's rigid body with `userData` (`{ isDie: true, dieId }`) so contact handlers can tell
die-vs-die apart from die-vs-table.

### B. Collision emotes

- **Trigger**: `onContactForce` on `RollingDie`, filtered to die-vs-die contacts via `userData`, above
  a force threshold, with a per-die cooldown (~700ms) so a tumble doesn't spam.
- **Emitter**: only the controlling client of a die emits for that die. Because A's die is dynamic on
  A's screen and B's die is dynamic on B's screen, a single A-hits-B collision produces one emote from
  each side — both dice react, and everyone sees both.
- **Choice of emote**: scaled by impact force (light → unimpressed/indignant, hard → dizzy/hurt/angry),
  with some randomness for character.
- **Protocol**: new `DIE_EMOTE` client message and `DIE_EMOTE` server broadcast, a `dieEmoteSchema`
  enum, and a new `emote` rate limit sized for physics-rate traffic (not the 3/10s `reaction` limit).
  Emotes are ephemeral — broadcast only, never persisted.
- **Render**: an emoji sprite (three's `<sprite>` always faces the camera, so no billboard dependency)
  above the die, floating up and fading over ~1.2s. Emoji texture built with the existing
  `numberTexture.ts` canvas-texture pattern.

### C. Roll reactions: fix and persist

- **Persist**: add `reactions` to `rollRecordSchema` (`playerId`, `reaction`, `at`). The server appends
  on `REACT_TO_ROLL` and includes them in the room snapshot, so they survive reconnects and reach late
  joiners. Clicking your own existing reaction toggles it off.
- **Reachable**: add a reaction affordance directly on the history row, so a roll can be reacted to
  whether or not its dice are still on the table. Keep the existing die-menu path.
- **Inline**: render reaction chips inside the same history row as the roll, per the user's request.
- Keep the live floating toast as a flourish, now backed by persistent state.
- Raise the `reaction` rate limit modestly — 3/10s is stingy for a group table.

## Scope boundaries

- No change to how dice results are decided or reported. Physics-authoritative stays as-is.
- Emotes are cosmetic and ephemeral; they are never recorded in history.
- Held/grabbed dice (`HeldDiceLayer`) are out of scope — no collision or emotes while held.
- Not attempting deterministic cross-client physics. Clients will disagree slightly on bounce visuals;
  that is accepted and consistent with the existing decision.
- Not fixing the pre-existing client-only name/color history event rows (still a Known Issue).

## Open questions

- Emote force threshold and cooldown are guesses until a real feel-check on hardware.
- Whether the reaction toast still earns its place once chips are visible in the row.
