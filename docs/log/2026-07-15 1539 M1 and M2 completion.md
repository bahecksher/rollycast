# 2026-07-15 1539 M1 and M2 completion

## TL;DR
- What changed: Finished and verified M1 local 3D dice; completed M2 Worker room creation, WebSocket
  presence, profiles/colors, reconnection, expiration, UI, and automated coverage.
- Why: The previous session stopped midway through M2 while `state.md` still described M1 as starting.
- What didn't work: Initial browser verification reused an orphaned Vite process after Wrangler was killed
  by a command timeout. Playwright now starts/checks Vite and Wrangler independently using a 200-status
  Worker readiness URL.
- Next: M3 server-authoritative shared rolls, transform synchronization, finalization, and late joining.

---

## Full notes

### Recovered handoff

- Audited the filesystem because it was ahead of `docs/state.md`.
- Found M1 implementation present and M2 server work stopped on an undefined
  `ServerPlayerWithDisconnect` type plus a missing Worker entrypoint.
- Reused `ServerPlayer`, which already includes `disconnectedAt`, and restored a clean typecheck.

### M1 verified

- Procedural numbered d6/d20 geometry and colliders.
- Rapier table physics, pointer drag/release and button throws.
- Stillness/max-duration detection and shortest-arc reconciliation to the official top face.
- Five face/orientation unit tests pass, covering every d6 and d20 result.
- Desktop Playwright smoke passes and 100 sequential rolls remain responsive without page errors.

### M2 completed

- Added Worker entrypoint and `POST /api/rooms`; room codes are allocated securely and checked for
  collisions before Durable Object creation.
- Completed PartyServer room creation/lookup, joining, player/color assignment, reconnect identity,
  presence broadcasts, disconnect grace, expiration alarms, message validation, and token hashing.
- Added Partysocket client lifecycle with validated server-message handling and localStorage identity.
- Added profile/color selection, connection indicator, player count/list, and assigned local dice color.
- Root dev script starts Vite and Wrangler; Vite proxies both `/api` and `/parties`.
- Playwright manages the two dev services independently so service readiness and cleanup are reliable.

### Tests and verification

- `npm run typecheck` passes across all workspaces.
- `npm test` passes: 70 shared + 5 web + 3 Worker integration = 78 tests.
- `npm run lint` and `npm run format:check` pass.
- `npm run build` passes; the 3D scene remains lazy-loaded. Vite warns that the scene chunk is large.
- Desktop Playwright: landing creation/validation, two-session presence, reload identity, 3D smoke, and
  100-roll stability pass.
- Phone-portrait Playwright: landing creation/validation, two-session presence, and reload identity pass.
