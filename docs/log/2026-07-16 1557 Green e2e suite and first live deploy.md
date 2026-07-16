# 2026-07-16 1557 Green e2e suite and first live deploy

## TL;DR

- **What changed:** Removed the duplicate "d20 showing 15" label. Fixed every red e2e spec — five, not
  the three previously counted. Deployed to rollycast.com.
- **Why:** User: "fix it all and deploy on rollycast.com".
- **What didn't work:** I stashed the user's working tree to test `main` while their dev server was
  running, which silently reverted the app under them — they reported "the emotes got turned off".
  Restored immediately, nothing lost, but it should not have happened mid-session.
- **Next:** Feel-check emotes and collision on the live site.

---

## Full notes

### The e2e suite was worse than reported

I had claimed three stale specs based on a grep for the Roll button. That grep missed two. Verified
against `main` (which is what caused the mishap below) that all five were red *before* this branch:

| spec | why it was red |
| --- | --- |
| `dice-local` | Roll button moved behind the floating Dice menu |
| `shared-roll` | same |
| `complete-dice` | die-type buttons behind the menu, **and** drove a "Roll modifier" input that no longer exists |
| `appearance` | toggle renamed "Table appearance" → "Host controls" |
| `full-room-flow` | all of the above, plus the old two-step actions popup and the keep/release flow |

The first four were selector fixes. `full-room-flow` needed a genuine rewrite: it drove "Actions for
selected die" → menuitem "Pick up and reroll" → "Keep die" → "Release die", and this branch removed
every one of those. Rewritten around the inline panel actions while keeping the test's original
intent: a guest is offered nothing on someone else's die (asserts `.inspection-action-empty`), the host
rerolls their own, anyone may react, and enabling `shared_rerolls` then lets the guest pick up the
host's die. The keep/release legs are gone with the feature; the shared-reroll assertion that depended
on a kept die went with them.

Result: **10/10 desktop-chrome and 10/10 mobile-portrait** — the suite has not been fully green all
session.

### The mishap

To find out whether `appearance` and `complete-dice` were pre-existing failures or mine, I ran
`git stash -u && git checkout main` and tested there. The user had the dev server open at the time, so
Vite hot-reloaded them onto `main` — no emotes, old panel. They noticed within seconds ("looks like the
emotes got turned off?").

Restored with `git checkout <branch> && git stash pop`; verified thresholds and the label removal were
back. Nothing lost, but checking out a different commit while someone is using the dev server is a bad
move. Answering "is this pre-existing?" was worth doing — `git stash` was the wrong way to do it.

### Deploy

`wrangler whoami` showed an existing OAuth session (bretthecksher@gmail.com, `workers (write)`), which
retires the long-standing "live deployment requires Cloudflare authorization" known issue.

`PROTOCOL_VERSION` deliberately stays at 1 despite `ROLL_REACTION` gaining two required fields. Bumping
it would make old still-open tabs reject *every* message rather than just dropping reactions until
reload — strictly worse for the deploy window.

### Verification

typecheck / lint / format / build clean, 105 unit tests, 20/20 e2e across both projects, then deployed
and checked the live site.
