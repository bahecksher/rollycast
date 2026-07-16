# 2026-07-15 1725 Host table appearance

## TL;DR
- What changed: Added host-only synchronized colors and a compact uploaded background image for the rolling
  table, with persistence, validation, rendering, tests, spec, and plan updates.
- Why: The room creator should be able to establish the shared rolling area's visual identity.
- What didn't work: This shell has no Node/npm on PATH. VS Code's embedded runtime handled most checks but
  could not execute Cloudflare's test pool or Wrangler dev because those tools depend on a normal Node
  executable identity. No product workaround was added.
- Next: Re-run Worker integration/appearance E2E in normal npm, then resume M5 inspection.

---

## Full notes

Created `docs/spec/2026-07-15 1707 Spec - Host table appearance.md` and the matching append-only plan
revision. The initial feature includes a table surface color, rim color, scene background color, and optional
host-selected PNG/JPEG/WebP. Remote URLs, crop controls, animation, and permanent asset storage remain out of
scope.

Extended shared `RoomSettings` with `RoomAppearance`, six-digit hex validation, safe raster data-URL
validation, a 48,000-character encoded-image cap, and defaults matching the previous hard-coded scene. The
Worker migrates older room settings in memory, requires both host identity and the private host token,
persists updates, increments room state, broadcasts them, and includes them in late-join snapshots.

The responsive host panel supports three native color inputs, reset, image selection, preview, removal, and
explicit save. Source images are limited to 10 MB, drawn to a bounded canvas, progressively resized and
JPEG-compressed, and rejected if they cannot fit the protocol limit. The R3F table now consumes synchronized
colors and loads the image as a table texture without suspending or resetting the physics subtree.

Added two shared protocol tests, one Worker integration test covering guest denial/broadcast/late join, and
one desktop/mobile-compatible Playwright flow covering host-only UI, color/image save, and reload persistence.

Verification completed:

- Shared, Worker, and web TypeScript checks: pass.
- Shared unit tests: 72 pass.
- Web unit tests: 13 pass.
- ESLint: pass.
- Prettier check: pass.
- Web and Worker esbuild parsing/bundling: pass (Cloudflare runtime module externalized for the diagnostic
  Worker bundle).
- Vite production build: pass; the existing large lazy-scene warning remains.

Worker integration and Playwright execution remain unverified in this particular shell. The normal npm
command was unavailable. The embedded VS Code runtime could run Vitest but Cloudflare failed to resolve its
virtual `cloudflare:test-internal` module; Wrangler also parsed the embedded runtime's script path as a CLI
argument. Both failures are environment-runner limitations and are recorded in state rather than hidden.
