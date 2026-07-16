# 2026-07-15 2202 Physics-authoritative dice results

## TL;DR
- What changed: The die now shows whatever face it lands on, and that IS the result — no more correcting the
  visible die to an independent server number, which was the source of the "flip."
- Why: The user found the settle flip confusing; tuning it (earlier trigger, faster snap) wasn't enough, so
  they chose to make physics decide the result, accepting the anti-cheat trade-off for friendly tables.
- What didn't work: Two rounds of masking the reconciliation flip. The flip is inherent when the physics face
  and the server face are independent.
- Next: User eyeball on the live server; decide whether shared-roll.spec's "server-authoritative" naming
  should be refreshed (cosmetic).

---

## Full notes

### Decision
Reverses the server-authoritative-result requirement (Initial Spec §7.2/§28) and the reconciliation decision.
New spec: `docs/spec/2026-07-15 2202 Spec - Physics-authoritative results.md`. Decision recorded in
`docs/decisions.md`.

### Design (minimal, keeps a safety net)
- The server's secure RNG stays, but its value is now **provisional/fallback** — used verbatim only when the
  rolling client disconnects before settle (`finalizeAbandonedRolls` unchanged, so abandoned rolls still
  finalize). Normal rolls overwrite it with the physics face. This avoided touching roll creation, rerolls
  (`grabs.ts`), and the abandoned-roll path.
- The acting client reports landed faces at settle; the server validates range and records them.

### Touch points
- `packages/shared`: `isValidDieResult` (dice.ts), `rollTotalFromDice` (state.ts), `dieResultSchema`, and
  optional `results` on `RollSettledPayload` + `RollFinalizedPayload` (messages.ts).
- `apps/worker`: `finalizeRoll` adopts valid reported faces, recomputes the total, returns them;
  `handleRollSettled` includes `results` in the broadcast **only when reported** (keeps the abandoned-roll
  payload exact — the `toEqual({rollId, transforms})` worker test still passes).
- `apps/web`: `RollingDie` tumbles freely, waits for a genuine rest, reads the up-face via `upFaceValue`,
  levels that same face flat, and reports it; `RemoteDie` drops the per-face correction (just follows the
  streamed/settled transform); `localRoller.markSettled` collects + sends the faces, `receiveFinalized`
  adopts them and recomputes the total; `roomCommands.settleRoomRoll` carries `results`.

### Bug caught during verification
First live run showed `[16] 5` — die result and total disagreed because `receiveFinalized` updated
`meta.dice` but not `meta.total`. Fixed by recomputing `meta.total = rollTotalFromDice(dice, modifier)`.

### Verification
- typecheck, 97 unit tests, lint, format, build, and all 18 Playwright e2e pass.
- Live: rolled 1d20 repeatedly with a host + observer; log and observer agree, and a screenshot confirmed the
  die's top face matches the recorded number (e.g. top face "20" ↔ log "[20] 20"). No flip.
