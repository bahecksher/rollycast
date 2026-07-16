# 2026-07-15 1607 M3 and M4 completion

## TL;DR
- What changed: Completed server-authoritative shared rolls, transform synchronization, finalization,
  late-join state, the complete standard dice set, percentile d100, mixed pools, and modifiers.
- Why: Continued the approved straight-through milestone plan from the completed M2 handoff.
- What didn't work: The first shared-roll E2E exposed inconsistent owner names between live and snapshot
  history; live metadata is now enriched from presence. One snapshot `.map` callback passed its index into an
  optional name parameter; the explicit callback fixed the typecheck.
- Next: M5 inspection highlighting and accessible interaction menu.

---

## Full notes

### M3 authoritative shared rolls

- Worker generates every official result with secure rejection-sampling RNG; clients never claim results.
- Added pool/modifier validation, visible-dice caps, bounded gesture approval, idempotent per-player
  `clientRollId`, persisted roll records, active control state, and history pruning.
- Only the acting client runs Rapier. It streams grouped transforms at no more than 12 Hz; remote clients
  interpolate kinematic visuals and do not affect physics.
- Transform and settle messages require the acting player, known die IDs, bounded finite transforms, valid
  unit-ish quaternions, monotonic sequences, and a complete final die set.
- Results remain hidden until all dice reconcile and the Worker broadcasts `ROLL_FINALIZED`.
- Room snapshots restore roll history, visible dice, ownership, status, and final transforms for late joiners.
- Worker tests cover secure broadcast, duplicate suppression, unauthorized transforms, finalization,
  persisted late-join state, and malformed messages.

### M4 complete dice set

- Added procedural tetrahedral d4, octahedral d8, pentagonal-trapezohedron d10, dodecahedral d12, plus the
  existing d6/d20. Convex-hull colliders and grouped coplanar face definitions match the visual solids.
- Face/orientation tests now cover all results of d4, d6, d8, d10, d12, and d20 from five starting rotations.
- d100 generates independent secure tens/ones d10 faces; `00 + 0` maps to 100. Percentile labels render as
  `00..90` and `0..9`, while reconciliation uses the underlying d10 face values.
- Added all standard types to the tray, responsive wrapping, quantity selection, optional mixed-pool chips,
  and integer modifiers from -999 through 999.
- Shared history reconstructs canonical expressions and logical d100 results from physical dice records.

### Verification

- `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`, and `npm run build` pass.
- 89 automated tests pass: 70 shared, 13 web orientation, and 6 Worker integration.
- Desktop and phone E2E pass for shared rolls/late join and the complete dice test, including
  `2d6 + 1d20 + 5`.
- Desktop 3D smoke and 100-click stability pass through the server-authoritative path.
- Vite still reports the expected large lazy 3D chunk warning; tracked for M9.
