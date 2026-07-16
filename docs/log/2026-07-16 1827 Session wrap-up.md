# 2026-07-16 1827 Session wrap-up

## TL;DR

- **What changed:** Cross-player dice collision, dice emotes, roll reactions that persist and live on
  their history row, a trimmed one-surface inspection panel, inspected dice held on the table, the
  whole e2e suite repaired, and the app deployed live to rollycast.com.
- **Why:** A run of user requests through the session, from "I want collision on the dice" to
  "fix it all and deploy on rollycast.com".
- **What didn't work:** Three mistakes worth carrying forward — the emote threshold (twice), a green
  production test that proved nothing, and reverting the user's working tree under a live dev server.
- **Next:** Feel-check emotes and collision on the live site.

---

## Full notes

This wraps a session logged in four earlier files (1428, 1448, 1509, 1557). Rather than repeat them,
this records what shipped and what is worth remembering.

### Shipped

| Area | Outcome |
| --- | --- |
| Collision | `RemoteDie` became a kinematic body; cross-player dice collide, results untouched |
| Emotes | Die-on-die knocks broadcast an emoji room-wide; ~2.5/throw |
| Reactions | Stored on `RollRecord`; chips on the roll's own history row; survive reconnects |
| Panel | One surface, actions inline, trimmed to Reroll + Clear roll |
| Expiry | Inspected rolls held by a client keep-alive |
| E2E | Five red specs fixed; 11/11 desktop + 10/10 mobile — green for the first time |
| Deploy | Live at rollycast.com, version `4d61cc41`, verified in production |

Protocol grew three messages (`DIE_EMOTE`, `KEEP_ROLL_ALIVE`, `ROLL_EXPIRY_EXTENDED`) and
`RollRecord` gained `reactions`. Unit tests went 97 → 105.

### Three mistakes worth keeping

**Tuning to the wrong scenario, twice.** The emote force floor was first set below the median contact
force (dice emoted constantly, saturating the rate limiter *exactly* — the limiter was shaping the
feature). Re-measuring fixed the number but against a 12-die pile-up, which reaches forces past
16,000. A real two-die throw tops out near 500, so the floor of 800 was literally unreachable and the
user could never trigger an emote at all. Measuring the *common* case gave floor 250 → ~2.5 emotes per
throw. Tune to the common case, verify the extreme.

**A green test that proved nothing.** The post-deploy production check passed while the deploy had, in
fact, broken every open tab. `browser.newContext()` starts with an empty cache, so it only tested a
fresh visitor — the one population that could not be affected. When verifying a deploy, the question
is not "does it work" but "does it work *for the clients that already exist*".

**Reverting the user's tree while they were using it.** `git stash && git checkout main` to check
whether two failures were pre-existing silently hot-reloaded the user onto old code mid-session; they
noticed within seconds ("looks like the emotes got turned off?"). Restored, nothing lost. The question
was worth answering — the method was not. Answer it on a worktree or a second clone.

### State

`main` pushed at `394c092`, working tree clean, deployed and live. Local dev servers left running
(`vite` on 5173, `wrangler` on 8787). Four things are left for the user to decide, all recorded in
state.md — none block anything.
