# 2026-07-16 1509 Trim die actions, fix emote threshold, hold inspected dice

## TL;DR

- **What changed:** Cut die actions down to Reroll + Clear roll; removed the modifier row and the
  per-die result chips. Fixed emotes never firing (threshold was unreachable in normal play).
  Inspected dice no longer get swept off the table while you are looking at them.
- **Why:** All four came straight from the user, including "Dice should react more often. I have yet to
  trigger it."
- **What didn't work:** My emote threshold. Twice. Details below — it is the main lesson here.
- **Next:** Feel-check emote frequency (~2.5/throw now). Decide whether multi-die rolls need their
  per-die values back in the panel.

---

## Full notes

### The emote bug: I tuned to the wrong scenario

The user could not trigger an emote at all. They asked whether it was limited to *other players'*
dice. It is not — the filter is "is the other body a die", so your own dice colliding count.

The real cause was my threshold. Earlier today I found the first-pass floor (45) was below the median
contact force and saturated the rate limiter, so I re-measured — but I measured a **12-die pile-up**,
which produces forces up to 16,000, and set the floor at 800. Nobody rolls 12 dice at once.

Measured the common case this time (8 throws of 2 dice):

```
CONTACTS: 938 (117/throw)   p50=13  p75=18  p90=58  p95=144  max=505
  >=100: 8.3/throw   >=300: 3.3/throw   >=400: 1.0/throw
  >=600: 0           >=800: 0        <- the shipped floor
EMOTES BROADCAST: 0 over 8 throws
```

The floor was **literally unreachable** with two dice. Zero emotes, exactly as reported.

Retuned to floor 250 / medium 450 / heavy 1,000, scaled to the range an ordinary throw occupies.
Result: 20 emotes over 8 throws (~2.5/throw) for 2 dice — and *also* ~2.5/throw for 6 dice, i.e. the
per-die cooldown is now the binding constraint rather than the rate limiter. Verified both.

The lesson worth keeping: **tune to the common case and verify the extreme, not the reverse.** I had
even written "a normal 1–2 die throw may emote rarely" into Known Issues and shipped it anyway rather
than spending the two minutes to measure it.

### Trimmed die actions

Now only Reroll (renamed from "Pick up and reroll") and Clear roll. Removed "Select more dice", "Keep
die", "Move die"; removed the Modifier row (there is no modifier control any more) and the per-die
result chips (`inspection-results`), which duplicated the "D20 showing 14" label.

Knock-ons handled: the multi-select block in the panel became unreachable once "Select more dice" was
gone, so it went too, along with the now-dead handlers and `openMenuFromElement`. Both the panel and
the popup menu still build from the one `dieActionsFor` helper, so they trimmed together.

Left alone (out of scope, still present in state/protocol/server): `SET_DIE_KEPT`, move grabs, and the
multi-select store methods. Only the UI entry points are gone.

### Inspected dice no longer vanish

Removing "Keep die" removed the only way to stop the 30s sweep, and the user asked for selection to
protect a die.

Rejected approaches:
- *Client-side only* — the server owns expiry (`expireUnkeptDice` on the room alarm) and broadcasts the
  removal, so a client that refuses to drop the die just desyncs.
- *Auto-keep on selection* — `canKeepDie` is owner-only so it would not protect another player's die,
  and `kept` is shared state that two players selecting different dice would fight over.

Chosen: `KEEP_ROLL_ALIVE { rollId }`, re-sent every 10s while a roll is inspected. The server pushes
that roll's unkept settled dice out by a full lifetime, reschedules the alarm (which already accounts
for `expiresAt`), and broadcasts `ROLL_EXPIRY_EXTENDED` so other clients don't start an expiry fade on
a die that is no longer expiring. It shares no inspection state — only "this roll is still wanted" —
which keeps the spec's local-only inspection intact. Deliberately does not `touch` the room, so reading
the table doesn't extend the room's own 24h TTL.

Verified both directions in the real app: an inspected die survived 40s (old build swept it at 30), and
after closing the panel it expired within 35s — the keep-alive stops, so dice don't leak into living
forever.

### Verification

- typecheck / lint / format / build clean; 105 unit tests pass (78 shared + 16 web + 11 worker).
  New worker test covers the keep-alive extension and that a keep-alive for an unknown roll is ignored
  rather than erroring (ping/pong round-trip used to flush the pipeline before asserting).
- `e2e/reactions.spec.ts` still passes after the panel rework.
- Panel screenshot: 1d20 → 15 → Rolled → "D20 showing 15" → Reroll / Clear roll → reactions. Notably
  shorter, which incidentally helps the mobile-portrait crowding.

### Flagged for the user

Removing the result chips means a **multi-die roll no longer shows its individual dice values in the
panel** — 2d20 shows the total and only the selected die's face. History rows still show `[14, 4]`.
Offered to bring the chips back for multi-die rolls only.
