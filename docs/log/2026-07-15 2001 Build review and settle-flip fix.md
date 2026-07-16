# 2026-07-15 2001 Build review and settle-flip fix

## TL;DR
- What changed: Reviewed the current build end-to-end, reworked the dice settle correction to reduce the
  visible "face flip," and made the Playwright suite reliable (fixed 3 real test bugs + serialized workers).
- Why: User asked to double-check Codex's work, test it hands-on, and fix a confusing post-roll face flip.
- What didn't work: A CDP touch-drag rewrite for the mobile reroll was a dead end — the real blocker was an
  overlay covering the canvas, not mouse-vs-touch input.
- Next: Human eyeball on the settle correction on a real GPU; consider mobile inspection-panel overlap.

---

## Full notes

### Verification of Codex's build
- System Node 24 (winget) is now available, so the portable `.tools/` runtime was not needed.
- Clean: `typecheck` (3 workspaces), `lint`, `format:check`, `build`, 97 unit tests (72 shared + 16 web +
  9 worker — the worker tests state.md said had never run).
- E2E had **never actually been run** (state.md admitted this). First real run: 12/18 failed. Investigation
  showed most were environmental, plus three genuine test defects and one contention problem — all fixed.

### Dice settle "face flip" (spec §7.3; recorded in the 1702 log)
- First attempt (start the turn a bit sooner + ease it) was NOT enough — user still saw the flip.
- Measured the real behavior with a temporary per-frame up-face trace (`__DICE_TRACE__`, since removed) driven
  by a Playwright probe. Ground truth: the die comes to a readable rest on a WRONG face for ~180–330 ms while
  still in the "rolling" phase (often sliding with one face up), and only then does the reconcile run — a slow,
  angle-scaled turn up to 0.5 s that visibly rotates through several faces. Both halves read as a flip.
- Real fix in `apps/web/src/scene/RollingDie.tsx`:
  - Trigger the correction while the die is still in motion, not after full rest: raise the settle velocity
    gates (SETTLE_LINEAR 0.45 → 2.5, SETTLE_ANGULAR 0.7 → 6), require the die to be down on the table
    (height gate) and past the initial tumble (MIN_ROLL_DURATION 0.3 s), with a 0.03 s debounce.
  - Make the turn a quick snap, not a slow rotation: RECONCILE duration 0.06–0.12 s (was 0.16–0.5 s), so the
    in-between faces blur past too fast to read.
- Measured after: stable-wrong-face before the turn dropped to ~0–170 ms (and the die is in motion during it),
  the turn itself to ~60–85 ms, final face always correct. A screenshot burst confirms the die settles onto a
  stable face with no slow rotation visible between 90 ms frames.
- Deliberately did NOT touch `targetQuaternionForResult` — the tested face mapping and identical final
  transform across clients are preserved (orientation.test.ts still green). Physics is unchanged; only the
  settle-detection thresholds and the correction's speed changed.
- Still subjective: needs the user's eyes on a real 60 fps GPU to confirm it reads well. Knobs are all named
  constants at the top of RollingDie.tsx if further tuning is wanted.

### Cleanup note
- The repo had an untracked `__record.mjs` at session start (scratch, `__` prefix, not in git). I reused that
  name for a recording probe and removed it during cleanup, so that pre-existing scratch file is gone. Nothing
  tracked was affected.

### E2E reliability
- `playwright.config.ts`: set `workers: 1`. Each case drives 2–3 contexts + a heavy WebGL scene + one local
  Durable Object; parallel workers overwhelmed that and caused cascading WebSocket/WebGL failures.
- `full-room-flow.spec.ts`, three real bugs:
  1. Left the floating appearance panel open, which overlaid the roll log it clicked next → close it.
  2. Reroll drag-throw used mid-canvas coords; on mobile portrait the inspection panel overlays the lower
     half of the table, so the drag hit the panel. Confirmed with a scratchpad probe (elementFromPoint +
     canvas pointer-event counts). Fix: drag in the clear upper third (~0.34h). Plain `page.mouse` delivers
     pointer events fine once it actually hits the canvas.
- `appearance.spec.ts`, two real bugs:
  1. Read `host.url()` before the room navigation settled → guest loaded the landing page. Wait for the
     `/room/CODE` URL first.
  2. Set the color input via `input.value = …`, which updates React's value tracker so onChange never fires
     and the *default* color got saved. Use the native prototype value setter (standard React-in-test
     workaround).
- Result: `npx playwright test` → 18/18 passing.

### Notes for later
- Mobile inspection panel overlapping the table during a reroll throw is usable (clear upper strip) but a
  minor UX rough edge in a mobile-first app.
- No product bugs were found in this pass — all e2e failures were environmental or test-authoring defects.
