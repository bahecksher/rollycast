# 2026-07-16 1448 Inspection panel - inline die actions

## TL;DR

- **What changed:** Removed the "Actions for selected die" button. The inspection panel now shows the
  selected die's actions inline, along with a reaction row. Extracted `dieActionsFor` so the panel and
  the popup menu share one definition of what a die can do.
- **Why:** User: clicking a die pops the "Inspected roll" panel, and then "Actions for selected die" is
  redundant — two surfaces and two clicks for one job.
- **What didn't work:** Nothing broke. First attempt to verify by clicking dice on the canvas missed
  them; opened the panel from a History row instead, which reaches the same panel deterministically.
- **Next:** Feel-check on mobile portrait — the panel is taller now and already covered ~half the
  canvas there.

---

## Full notes

### Shape of the change

Before: click die → `inspection-panel` opens → click "Actions for selected die" → `dice-action-menu`
pops up *on top of the panel*, anchored under the button. Two surfaces stacked, showing overlapping
information.

After: the panel has an `inspection-die-actions` section — a label naming the selected die ("d20
showing 14"), a two-column grid of that die's permitted actions, and a compact reaction row.

Asked the user where the actions should live rather than guessing, because there were two viable reads
of "move some of that detail into the clicked into menu that pops up". They chose inline-in-the-panel,
and to keep reactions on both surfaces.

### Why the panel had to stay

The panel is load-bearing beyond die clicks: `RollLog` rows call `inspectRoll(entry.id)` to open it,
and the popup menu's own "Inspect roll" item does too. Deleting it would have left History with nothing
to show. That ruled out the "popup replaces the panel" alternative.

### Why the popup menu stays too

It is still the right-click/long-press affordance on the 3D die, and right-clicking a result chip in
the panel opens it. It keeps its "Inspect roll" item, which the panel version omits (you are already
inspecting).

### Avoiding a second copy of the permission rules

Both surfaces need the same `canRerollDie` / `canKeepDie` / `canMoveDie` / `canClearDie` gating. Rather
than duplicate that logic, added `features/inspection/dieActions.ts` exporting `dieActionsFor(die,
requesterId, mode, handlers)` which returns a list of `{ key, label, run }`. The panel renders them as
a button grid; the menu renders them as `role="menuitem"` rows. This is the second small extraction
this session (after `reactionCatalog`), both for the same reason: a third copy was about to appear.

Dropped `openMenuWithKeyboard`, which existed only to serve the removed button.

### Verification

- typecheck / lint / format / build clean; 104 unit tests still pass.
- Drove the real app: panel renders with 5 inline actions, the "Actions for selected die" button is
  gone (asserted count 0), zero console/page errors. Screenshot confirms the layout reads as one
  surface — roll summary, dice, details, "D20 showing 14", the action grid, reactions. The
  odd-numbered-last-action full-width rule works ("Clear roll" spans both columns).
- Confirmed the popup menu still opens from a result chip and lists 7 items (Inspect roll + the 5
  shared actions + React) — i.e. both surfaces genuinely build from the shared list.

### Note

The panel grew taller. The pre-existing Known Issue about it covering ~half the canvas on mobile
portrait is now slightly worse; worth a look during the next feel-check.
