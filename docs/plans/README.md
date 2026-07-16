# Plans

Append-only. One file per plan or plan revision.

Naming:
- New plan: `YYYY-MM-DD HHMM Plan - Subject.md`
- Revision: `YYYY-MM-DD HHMM Plan revision - Subject.md`

Get the timestamp from `date '+%Y-%m-%d %H%M'`.

Once written, don't edit — create a new revision file instead. The most recent file for a given subject is the active plan. `state.md` should always point to it.
