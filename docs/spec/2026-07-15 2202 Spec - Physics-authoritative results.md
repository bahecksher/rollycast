# Spec - Physics-authoritative results
_Created: 2026-07-15 2202_
_Supersedes the roll-result authority parts of `Initial Spec.md` (§7.2, §7.3, §28, §36 items 4–5)._

## Why this change

The Initial Spec required the server to generate every official die result with secure randomness and the
visible physics to never determine it (§7.2, §28). The client therefore tumbled the die under physics and
then rotated it to the server's independent face. That correction was visible as a "flip" — the die landed
showing one number, then turned to another — which the user found confusing. Tuning the correction (starting
it earlier, snapping it faster) reduced but did not remove the effect, because the physics face and the
server face are independent.

The user chose to make the die physics-authoritative for a friendly, account-free dice table, accepting that
a tampered rolling client could influence its own results.

## New behavior

1. The die tumbles under physics and comes to rest naturally. Whatever face is up **is** the result.
2. On settle, the die is only levelled flat onto that same face (a tiny same-face tidy, never a turn to a
   different number), so nothing flips.
3. The acting (rolling) client reports the landed faces to the server with the settle message.
4. The server validates each reported face is in range for its die type and records it, recomputing the roll
   total. All clients receive the results at finalization and display the same value.

## What stays the same

- The server still runs its cryptographically secure RNG, but the value is now a **provisional/fallback**:
  it is only used verbatim when the rolling client disconnects before the die settles (so an abandoned roll
  still finalizes with a plausible result). Normal rolls overwrite it with the physics face.
- Only the rolling client runs physics; other clients interpolate its streamed transforms (which already
  show the landed face) and record the finalized results. No cross-client physics determinism is required.
- The result is still not displayed until the die visibly settles.

## Explicitly out of scope / accepted trade-offs

- **Anti-cheat / tamper resistance for results.** A modified client can report a chosen face. Acceptable for
  friendly tables; revisit if the product ever needs trusted results.
- Fairness now depends on the physics being unbiased rather than on the RNG.
