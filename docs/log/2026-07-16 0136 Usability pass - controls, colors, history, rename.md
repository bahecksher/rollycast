# 2026-07-16 0136 Usability pass - controls, colors, history, rename

## TL;DR
- What changed: A broad usability/polish batch — top-bar player controls, table/theme colors,
  zoom, dice-tray cleanup, off-table dice behavior, history coloring + events, and an app rename
  to **RollyCast**.
- Why: User-driven "clean up" session; a running list of feel/usability fixes.
- What didn't work: First attempt at fading missed dice read poorly — reverted to fall-away.
- Next: Optional dev-server feel-check on real hardware; `state.md`/docs still historical;
  git push + hosting deferred by the user.

---

## Full notes

### Top bar
- **Player name shown** next to the Room ID, and it is now a **click-to-edit** control
  (`PlayerProfilePanel`): change display name and dice color in a popover. Uses the existing
  `UPDATE_PLAYER` protocol (was defined but unused on the client). On `PLAYER_UPDATED` the client
  now syncs `self`, local identity, and the dice preview color (`applySelfUpdate`).
- **"Style" → "Host Controls"** (the host appearance panel summary).

### Theme / colors
- **Default board colors** swapped to grey surface `#767b83`, off-white rim `#e8e8e6`, soft orange
  backdrop `#c07a45` (shared `DEFAULT_ROOM_APPEARANCE`). Affects new rooms only; existing rooms keep
  their stored appearance until a host hits Reset → Save.
- **App theme blue → orange** (kept dark surfaces per user choice): `--accent`, `--accent-strong`,
  `--focus`, all `rgba(126,177,255,…)` tints, and the 3D die "related" highlight (gold "selected"
  highlight intentionally kept for contrast).

### Dice tray (bottom)
- Collapsed into a centered **hamburger "Dice"** control that floats at the bottom **over the
  backdrop** (grey bar removed; pointer-events pass through except the button so throws still work).
- Fixed the mojibake **"−"** (and pool-chip "×"), **removed the modifier field**, and
  **"Clear mine" → "Clear"**.

### Zoom
- Added **wheel + pinch zoom** (`CameraZoom`) that dollies the camera along its fixed view direction
  toward the table centre — deliberately not OrbitControls, so single-pointer throw drags are
  untouched. A `gestureState.pinching` flag makes `ThrowLayer` skip the touches during a pinch.

### Off-table dice ("missed the table")
- **Kept the fall-away** look (an earlier fade-in-place was reverted — read poorly).
- The controlling client detects when a die clears a wall / drops below the surface, **stops
  streaming its rogue position** (this was the source of the error flood), and notifies once.
- The missed roll is **skipped at settle time** (no out-of-bounds error), and exactly **one** cheeky
  nudge shows. Cheeky sayings live in shared (`sayings.ts`) and are reused server-side as a fallback
  (`randomOffTheTableSaying`).
- Note: the error flood got briefly worse because the server picked a *new random saying every
  rejected frame*; stopping the stream client-side fixed it at the source.

### History
- **Rows tinted** by the roller's die color (left color bar). Live rolls use the roll's `colorId`;
  hydrated rows fall back to the owner's current color (records don't store the die color).
- **Event rows**: a name change logs "Name change: Old → New" and a color change logs
  "Color switch: Name", both tinted, italic. These are live client-side markers (all connected
  clients see them) — not persisted across reconnect (would need a server-side event record).
- **History button** re-scoped to `.rolllog .rolllog-toggle` so it beats `.btn-ghost` regardless of
  stylesheet order — now reads grey like the Dice chip.
- Roller **name in history** already works via the server's per-roll name snapshot; the profile
  editor's `applySelfUpdate` makes the change visible immediately.

### Rename
- **Shared Dice Table → RollyCast** in user-facing spots: landing heading, `<title>`, root package
  description, and the e2e landing assertion. Docs (spec/plans/logs) left as historical record.

### Verification (system Node)
- `typecheck`, `lint`, `format:check`, `build`, and all **97 unit tests** (72 shared + 16 web +
  9 worker) pass. Playwright e2e not re-run this session (landing assertion updated to match the new
  heading; worth a run before deploy).

### Deferred by user
- Git push and GitHub Pages hosting were requested then postponed ("need to still change a few
  things"). Note for later: GitHub Pages is static-only; the Cloudflare Worker/DO backend can't run
  there, so a Pages deploy would be a frontend with no room server.
