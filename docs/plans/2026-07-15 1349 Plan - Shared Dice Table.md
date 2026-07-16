# Plan - Shared Dice Table
_Created: 2026-07-15 1349_

## Goal
Build a mobile-first multiplayer web app: a shared virtual dice table where a private group joins by room
code, throws standard RPG dice with visible 3D physics, and everyone sees the same server-authoritative
result. Not a full virtual tabletop. Implements docs/spec/Initial Spec.md.

## Approach

### Backend & cadence (settled with user)
- Backend: `partyserver` (PartyKit's Cloudflare-native successor) on Cloudflare Workers + one Durable Object
  per room, deployed via Wrangler; `partysocket` auto-reconnecting client. Local dev/tests need no account.
- Cadence: run straight through the milestones, runnable after each.

### Tech decisions
- Monorepo: npm workspaces — `apps/web`, `apps/worker`, `packages/shared` (shared protocol types + Zod).
- Client: TS strict, React 19, Vite, React Three Fiber, `@react-three/rapier`; Zustand for UI-agnostic room
  state (physics transforms in refs, never React state).
- Validation: Zod schemas in `shared`, run on every inbound WS payload.
- Dice visuals: procedural geometry + canvas-texture numbered faces; convex-hull colliders.
- Secure RNG: pure rejection-sampling `secureDieRoll(sides, getRandomBytes)` in `shared`; server injects
  Workers `crypto.getRandomValues`. Client never submits results.
- Deploy: one Worker serves the static SPA build and routes WS upgrades to the room DO (single origin).

### Architecture
```
RollyCast/
  package.json                 # workspaces + root scripts
  tsconfig.base.json
  packages/shared/src/         # protocol, schemas (zod), dice, notation, colors, rng, ids, interactions, rate-limits
  apps/worker/src/             # PartyServer RoomServer DO + Worker entry (static assets + WS routing), handlers, alarms
  apps/web/src/                # network (partysocket), state (zustand), scene (R3F), features, text fallback
  e2e/                         # Playwright (two contexts)
  docs/                        # conventions + architecture/protocol/interaction/deployment docs
```

Networking model: only the rolling client runs real physics and streams ROLL_TRANSFORMS (≤12/s); other
clients interpolate. Server generates official results (secure RNG) and broadcasts ROLL_CREATED. On settle,
each client reconciles every die to its authoritative face via a minimal-arc quaternion (slerp 200–350 ms,
then sleep). Server authoritative for membership, identity, ownership, results, roll IDs, reroll links, grab
locks, kept status, ordering, rate limits, expiration.

### Milestones (runnable after each)
- M0 Scaffold — workspaces, strict tsconfig, shared skeleton, Vitest/Playwright/lint, root scripts.
- M1 Local dice prototype — R3F + Rapier, d6 + d20, pointer throw, face reconciliation.
- M2 Rooms & presence — PartyServer DO, create/join, partysocket reconnect, players/colors, 24h expiration.
- M3 Shared rolls — server RNG, ROLL_REQUEST/CREATED, transform sync, history (cap 100), late-join, idempotency.
- M4 Complete dice set — d4/d8/d10/d12/d100, mixed pools, modifiers, quantity, dice tray.
- M5 Inspection & interaction menu — tap-inspect, highlight/dim, long-press/right-click, accessible action list.
- M6 Ownership & rerolling — grab locks, pick-up-and-reroll (single+multi), linked history, cancel/expire.
- M7 Shared rerolls — host Dice Handling setting, shared mode, acting-player attribution, kept protection.
- M8 Keep/Move/Clear/React — keep+release, set-aside, move, clear roll/unkept/all, reactions, fading/clutter.
- M9 Harden & deploy — rate limits, error states, text fallback, a11y, reduced-motion, perf, tests, deploy, docs.

### Testing (spec §38)
- Unit (Vitest): notation, pool validation, modifiers, d100, secure die-range, room codes, name sanitization,
  rate limits, duplicate clientRollId, history cap, face→orientation (every die × every result), ownership,
  shared-reroll perms, kept protection, grab-lock expiration, reroll linkage.
- Integration (`@cloudflare/vitest-pool-workers`): create/join, invalid code, full room, reconnection, color
  assignment, roll broadcast, late join, expiration, malformed WS, unauthorized transform, duplicate roll,
  grab allow/deny, shared-rerolls on/off, kept-grab deny, grab cancel/expire, reroll link, reaction rate-limit,
  clear-roll perms, host-setting auth.
- E2E (Playwright, 2 contexts): full spec §38.3 script; phone-portrait + desktop.

## Scope boundaries
Spec §40 non-goals: no character sheets, maps, tokens, initiative, voice/video/text chat, accounts, campaign
storage, rules automation, macros, public discovery, matchmaking, custom dice uploads. Audio/haptics (§33)
left as post-MVP hooks. History deletion not required. Host controls beyond Dice Handling + Clear All stubbed.

## Open questions
- Live deploy requires the user's Cloudflare account (config + docs provided; not deployed without creds).
- PartyServer API specifics (hibernation/alarms/storage) confirmed during M2; raw DO is the fallback.

_Source of truth for execution. Full approved plan also at
C:\Users\brett\.claude\plans\serialized-whistling-parnas.md._
