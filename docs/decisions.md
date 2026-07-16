# Decisions

One entry per decision. Format: **what**, why, date. Exists to prevent re-litigating.

---

**Backend = `partyserver` on Cloudflare Workers + Durable Objects (one DO per room), Wrangler deploy,
`partysocket` client.** The user asked about PartyKit; `partyserver` is its Cloudflare-native successor and
matches the spec's recommended Workers+DO+Wrangler stack with far less boilerplate, while keeping everything
on the user's own Cloudflare account. Raw DO is the fallback if a partyserver limitation surfaces. — 2026-07-15

**Monorepo via npm workspaces** (`apps/web`, `apps/worker`, `packages/shared`). pnpm/yarn aren't installed;
npm 11 workspaces are sufficient and keep setup dependency-free. — 2026-07-15

**Client state = Zustand; runtime validation = Zod; dice = procedural geometry with canvas-texture numbers.**
Zustand keeps room state UI-agnostic (shared by the 3D view and the text fallback) while physics transforms
stay in refs to avoid per-frame React churn (spec §35). Procedural dice avoid external 3D assets (spec "avoid
unnecessary dependencies") and make face→orientation mappings exhaustively testable. — 2026-07-15

**Only the rolling client runs authoritative-visual physics and streams transforms; other clients
interpolate and reconcile to the server's official face via a minimal-arc quaternion.** Avoids requiring
deterministic physics across machines; matches spec §22/§25.4/§25.5. — 2026-07-15

**Build cadence = straight through the 9 milestones**, runnable after each, per the user's choice. — 2026-07-15

**Room background images are client-normalized raster data URLs stored with room settings**, capped at 48,000
characters and restricted to JPEG/PNG/WebP. This makes host-selected images persist and synchronize through
the existing Durable Object without adding object storage or unreliable cross-origin texture URLs. The
browser accepts source files up to 10 MB, resizes them, and encodes a compact JPEG before sending. — 2026-07-15

**Dice results are physics-authoritative: the die shows whatever face it lands on, and that is the recorded
result.** This reverses the original server-authoritative-RNG design (spec §7.2/§28) and the reconciliation
decision above. Reason: reconciling the visible die to an independent server number always produced a
visible "face flip" after the die had landed, which the user found confusing; two rounds of masking the
flip did not satisfy. The user accepted the trade-off (a modified rolling client could influence its own
results) as fine for friendly tables. Implementation keeps the server's secure RNG as a *provisional/
fallback* value — used verbatim only when the rolling client disconnects before the die settles — and the
acting client reports the landed faces at settle, which the server validates (in-range) and records. See
`docs/spec/2026-07-15 2202 Spec - Physics-authoritative results.md`. — 2026-07-15

**Theme = dark surfaces with orange accents (not a full light theme).** The user asked for a
"white/grey/orange" look; offered a full light theme vs. keeping dark surfaces and swapping blue → orange,
they chose the latter. Board defaults are grey surface / off-white rim / soft orange backdrop; UI accents
(`--accent`/`--accent-strong`/`--focus`, blue highlight tints, the 3D "related" die glow) went orange. The
gold "selected" die highlight was deliberately kept to stay distinct from the orange "related" glow. — 2026-07-16

**Dice that miss the table fall away (not fade).** A fade-in-place was tried and reverted — it "read
poorly." The die keeps tumbling off under physics; the acting client just stops streaming the rogue
position on the first off-table frame (kills the per-frame server-rejection flood), skips the settle for
that roll, and shows exactly one cheeky "off the table" nudge. Missed rolls do not record. — 2026-07-16

**App name = RollyCast** (was working title "Shared Dice Table"). Changed user-facing surfaces only
(landing heading, page `<title>`, package description, e2e assertion); spec/plans/logs keep the historical
name. — 2026-07-16

**Other players' dice are kinematic physics bodies, not bare meshes.** Everyone throws into one tray, so
dice passing through each other read as broken. Each client already simulated only its own dice
(dynamic) and drew everyone else's as plain visual groups. Those remote dice are now real
`kinematicPosition` bodies following the same streamed transforms via `setNextKinematic*`, so local dice
collide with them. Kinematic (not dynamic) keeps the throwing client the sole authority over its own
die: a remote die shoves ours but is never shoved. The cost is that two clients disagree slightly on
the visual bounce — accepted, and the same trade-off already made for physics-authoritative results.
Results are unaffected: each client still reports only its own dice's landed faces. — 2026-07-16

**Dice emote when knocked, and emotes are broadcast rather than local.** The user asked for the dice to
have feelings about getting knocked about. Emotes fire on die-vs-die contact only (never walls or
landings, which happen every throw and would drown the table in emoji), are relayed through a new
`DIE_EMOTE` message, and are cosmetic-only — never stored on the roll, never in history. Because each
client simulates its own dice, one A-hits-B collision produces an emote from each side, so both dice
react and everyone sees both. They get their own rate limit (10 burst, 4/s) that drops silently rather
than erroring, since physics-driven traffic hitting a limit is expected and an error per dropped emote
would be noisier than the emote. — 2026-07-16

**Emote force thresholds are measured against an ordinary throw, not a pile-up.** Two rounds of getting
this wrong. First pass guessed a floor of 45, below the median contact force, so dice emoted constantly
and saturated the rate limiter exactly. Retuned to 800 by probing a *12-die pile-up* (median ~74, p90
~740, tail past 16,000) — but that scenario is not how anyone rolls, and a real two-die throw tops out
around 500, so the floor was literally unreachable and the user could never trigger an emote at all.
Measuring the common case (2 dice: ~120 contacts/throw, median ~13, max ~505) gave floor 250 / medium
450 / heavy 1,000, which yields ~2.5 emotes per throw for both 2- and 6-die throws, bound by the per-die
cooldown rather than the rate limiter. Lesson: tune to the common case and verify the extreme, not the
reverse. — 2026-07-16

**Only "Reroll" and "Clear roll" remain as die actions.** The user cut "Select more dice", "Keep die",
and "Move die", plus the modifier row (no modifier control exists any more) and the per-die result
chips. Consequences accepted: the multi-select flow is now unreachable from the UI, and dice can no
longer be manually kept — which is what motivated the keep-alive below. The underlying state, protocol
messages, and server handlers for keep/move/multi-select all remain; only the UI entry points are
gone. — 2026-07-16

**An inspected roll's dice are held on the table by a client keep-alive.** With "Keep die" removed,
nothing stopped a die being swept 30s after settling while a player was still looking at it. Inspection
is deliberately local-only (spec §9), so the server cannot know a die is selected; and auto-keeping on
selection was rejected because `canKeepDie` is owner-only (it would not protect another player's die)
and `kept` is shared state that two players would fight over. Instead a client re-sends
`KEEP_ROLL_ALIVE { rollId }` every 10s while it has a roll inspected; the server pushes that roll's
unkept dice out by a full lifetime and broadcasts `ROLL_EXPIRY_EXTENDED` so every client's fade agrees.
It leaks no inspection state — only "this roll is still wanted" — and stops when the panel closes, so
dice resume their countdown rather than living forever. — 2026-07-16

**Die actions live inline in the inspection panel; the "Actions for selected die" button is gone.**
Clicking a die opened the inspection panel, which then offered a button that opened a *second* popup on
top of it — two surfaces and two clicks to do one thing, which the user found confusing and redundant.
The panel now shows the selected die's actions directly. The right-click/long-press popup stays as a
fast path on the 3D die (and via right-click on a result chip), and the panel itself stays because
History rows depend on it to inspect a roll. Both surfaces build their action list from one
`dieActionsFor` helper so the permission rules can't drift apart. Reactions stay on both the die
surface and the history row: the row is the durable place, the die is the in-the-moment place. — 2026-07-16

**Roll reactions are stored on the roll record.** They were fire-and-forget broadcasts shown as an
1800ms toast and then discarded, reachable only through a submenu behind a long-press on a die — which
became impossible once unkept dice expired after 30s. Reactions now live on `RollRecord`, ship in the
room snapshot (so they survive reconnects and reach late joiners), toggle off when re-sent, and are
reachable from the roll's own history row. The broadcast carries the roll's full reaction set rather
than a delta, so a dropped message cannot leave a row permanently wrong. — 2026-07-16
