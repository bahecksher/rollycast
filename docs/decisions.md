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
