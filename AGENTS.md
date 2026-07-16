# AGENTS.md

This file tells you how to work in this project. Read it first, every session.

---

## Getting timestamps

All filenames and timestamps in this project use the format `YYYY-MM-DD HHMM` (24-hour, no colon).

To get the current timestamp, run:

```bash
date '+%Y-%m-%d %H%M'
```

Example output: `2025-12-08 1423`

Example filename: `2025-12-08 1423 Fixed auth bug.md`

Use this command every time you need a timestamp. Do not guess the time or omit the hours/minutes.

---

## On a fresh project

1. Check `docs/spec/` for the most recent spec file. That's the directional intent.
2. Create `docs/state.md` using the format below.
3. Run `date '+%Y-%m-%d %H%M'` to get the current timestamp.
4. Create an initial log: `docs/log/{timestamp} Kickoff.md`
5. Begin work.

## On an existing project

1. Read `docs/state.md` — current focus, what's working, what's next.
2. Read `docs/decisions.md` — don't re-litigate what's already been decided.
3. Check `docs/plans/` for any active plan. Follow it unless you have a specific reason not to (and if you don't, log the reason — don't silently diverge).
4. Only open a log file if `state.md` links you to one.

---

## Docs structure

```
docs/
├── spec/          Versioned specs. Most recent file is current truth.
├── state.md       Single file, rewritten each session. Current snapshot.
├── decisions.md   Append-only. One entry per decision.
├── log/           Append-only. One file per session.
└── plans/         Append-only. One file per plan or plan revision.
```

---

## state.md

Keep it to one page. Rewrite it (don't append) at the end of every session.

```
# State
_Last updated: YYYY-MM-DD HHMM_

## Current focus


## What's working


## In progress


## Known issues


## Next actions
1.
2.
3.

## Active plan
docs/plans/YYYY-MM-DD HHMM Plan - Subject.md

## How to verify


## Recent logs
- docs/log/YYYY-MM-DD HHMM Subject.md — one line summary
```

---

## Specs

Versioned files in `docs/spec/`. The most recent file is the source of truth.

When the spec changes meaningfully (not typos — real scope or direction changes), create a new file rather than editing the existing one. Name it:

```
docs/spec/YYYY-MM-DD HHMM Spec - Subject.md
```

The first spec in a project can just be `Spec - Initial.md` or timestamped — either works.

---

## Plans

Plans live in `docs/plans/`. They are append-only — once written, don't edit them.

**Creating a plan:**

After planning (whether in a dedicated planning mode or during a session), write the plan to:

```
docs/plans/YYYY-MM-DD HHMM Plan - Subject.md
```

Format:

```
# Plan - Subject
_Created: YYYY-MM-DD HHMM_

## Goal
What this plan accomplishes.

## Approach
How it gets done. Steps, phases, whatever structure fits.

## Scope boundaries
What's explicitly out of scope.

## Open questions
Anything unresolved.
```

**Revising a plan:**

When a plan changes during development, don't edit the original. Create a new file:

```
docs/plans/YYYY-MM-DD HHMM Plan revision - Subject.md
```

Format:

```
# Plan revision - Subject
_Created: YYYY-MM-DD HHMM_
_Revises: docs/plans/YYYY-MM-DD HHMM Plan - Subject.md_

## What changed
-

## Why
-

## Updated approach
Only the parts that changed. Reference the original plan for everything else.
```

Update `state.md` to point to the most recent plan or revision.

---

## Logs

One file per session. Append-only — never edit old logs.

```
docs/log/YYYY-MM-DD HHMM Subject.md
```

Format:

```
# YYYY-MM-DD HHMM Subject

## TL;DR
- What changed:
- Why:
- What didn't work:
- Next:

---

## Full notes

```

---

## Non-negotiable rules

- **Small, targeted changes.** No drive-by refactors.
- **Out-of-scope problems go in Known Issues** in `state.md`. Don't silently fix them.
- **Irreversible actions require a heads-up.** Say so before you do it.
- **When in doubt, check `docs/spec/` or ask.** Don't assume intent.
- **If you disagree with an existing plan or decision**, note the disagreement in your log and ask. Don't override.
- **Timestamps are not optional.** Every log, plan, and spec revision gets a timestamp from `date '+%Y-%m-%d %H%M'`. No exceptions.

---

## End of every session

Do these in order. If you might not get to finish, write state and log first, then make your final change. Defensive ordering — don't leave the project without documentation.

1. Rewrite `docs/state.md`
2. Write a new log file in `docs/log/`
3. Leave the project in a runnable state, or note explicitly in `state.md` that it isn't
