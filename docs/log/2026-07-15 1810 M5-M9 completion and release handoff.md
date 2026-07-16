# 2026-07-15 1810 M5-M9 completion and release handoff

## TL;DR

- What changed: Completed inspection/actions, ownership and linked rerolls, shared rerolls, keep/move/clear,
  reactions/fading, M9 resilience/performance/accessibility, tests, and production/deployment documentation.
- Why: Finish the approved straight-through MVP plan while keeping server authority and text accessibility.
- What didn't work: The embedded VS Code Node cannot run Cloudflare's test pool, Wrangler, or the local
  Worker/Playwright stack because child CLI arguments inherit the VS Code executable identity.
- Next: Run the Worker and browser suites with normal Node 20+, dry-run Wrangler, manually test target
  browsers/devices, then authenticate and deploy.

---

## Full notes

### M5 — inspection and actions

- Added a local-only inspection store shared by 3D dice and immutable history.
- Added roll/die inspection, related-die highlight/dimming, tap/click, long-press, context-click, Shift+F10,
  Context Menu key, Escape, focus management, and an accessible DOM action menu.
- Prevented the transparent throw plane from swallowing interactions intended for settled dice.

### M6-M7 — ownership and rerolling

- Added 10-second authoritative grab locks, precise denials, held transform streaming, cancel/expiration,
  single and multi-die pickup, linked rerolls, and deterministic held layouts.
- Preserved immutable source history, die owner/color, and separate acting-player attribution.
- Added the host's Owner only / Shared rerolls mode with server authorization and kept-die protection.

### M8 — table actions

- Added keep/release with limits, move-without-result-change, clear roll, clear mine, host clear all, and
  synchronized rate-limited reactions.
- Added 30-second unkept-die expiration, server alarms, and a client fade during the final second. Kept dice
  neither expire nor fade.

### M9 — hardening and deployment

- Applied shared token buckets to rolls, grabs, profile updates, reactions, settings, and transform scopes.
- Finalized unfinished rolls from their last accepted transforms when the acting browser disconnects.
- Corrected remote settled dice to official faces and started local reconciliation earlier in the settling
  motion to reduce the visible face switch.
- Added useful connected-error notices, reconnect wording, scene error boundaries, WebGL text fallback,
  reduced-motion behavior, and low-core/low-memory rendering settings.
- Configured Cloudflare Static Assets with SPA fallback and Worker-first `/api/*` and `/parties/*` routes.
- Added README, architecture, and deployment/rollback/security documentation.
- Added Worker coverage for abandoned rolls and reaction limiting, plus a full two-context owner/shared-reroll/
  keep/reaction/reconnect Playwright flow using both desktop and phone device profiles.

### Verification

- TypeScript: shared, Worker, and web workspaces pass.
- Unit tests: 72 shared and 16 web tests pass.
- Lint and Prettier: pass.
- Production web bundle: succeeds; landing JS is about 311 KB / 92 KB gzip and the lazy scene is about
  3.18 MB / 1.09 MB gzip.
- Playwright discovery: 18 cases across desktop Chrome and Pixel 7 profiles.
- Not executed here: 9 Cloudflare Worker integration tests, actual Playwright runs, Wrangler dry-run, and live
  deploy. These require a normal Node/npm runtime; live deploy also requires Cloudflare authorization.
