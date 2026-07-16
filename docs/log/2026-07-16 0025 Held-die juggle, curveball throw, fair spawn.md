# 2026-07-16 0025 Held-die juggle, curveball throw, fair spawn

## TL;DR
- What changed: The held (pre-throw) die now hangs and swings under the pointer like it is on a string
  and rolls in the drag direction; the throw imparts spin derived from your flick (curve-ball capable);
  and dice spawn at a random orientation so results stay fair.
- Why: User wanted the readied die to feel organic/tethered and to be able to throw a curve.
- What didn't work: n/a — but had to add fair-spawn once spin stopped being big-and-random.
- Next: User feel-check on real hardware; tuning knobs noted below.

---

## Full notes

### Held preview "on a string" (apps/web/src/scene/ThrowLayer.tsx)
- `ThrowLayer` now tracks live pointer velocity on the throw plane (`pointer` ref, updated in `move`).
- `JuggleDie` uses a damped spring so the die trails/​swings behind the pointer and hangs slightly below
  it, plus a soft idle bob; its angular velocity eases toward a target that rolls in the drag direction
  (with a little sideways curl), settling to a gentle idle tumble when you hold still.
- Respects reduced motion (stays static). Tuning: spring `stiffness`/damping and the idle/roll spin
  constants inside `JuggleDie`.

### Curve-ball throw (apps/web/src/scene/throwLayout.ts → localRoller receiveRollCreated)
- Replaced `randomAngularVelocity()` with `throwSpin(velocity)`: a rolling tumble about the axis
  perpendicular to travel (scales with speed) plus a vertical-axis curve component biased by how much
  you throw across the table, plus light randomness. Harder / more sideways throws curve more.

### Fair spawn orientation (the important correctness bit)
- Because results are now physics-decided AND spin is throw-derived (so a gentle throw barely tumbles),
  a fixed identity spawn orientation would bias the landed face. Added `randomSpawnRotation()` (uniform
  random quaternion) and use it for the controller's spawned dice. Fairness no longer depends on how
  hard you flick.
- Verified: 24 button rolls → 17 distinct values spread across 1–20, no clustering.

### Verification
- typecheck, 97 unit tests, lint, format, build, and all 18 Playwright e2e pass.
- Live: held die swings/rolls under a dragged pointer; a sideways-flick release rolls and finalizes a
  valid result; distribution check above.
