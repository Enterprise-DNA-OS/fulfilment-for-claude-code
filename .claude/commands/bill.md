---
description: "Draft a billing run for a period ending today"
---
# Draft a billing run for a period ending today

Read CLAUDE.md first. Run `npm run fulfil -- bill --from=YYYY-MM-DD`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Run `attention` first: a missing rate stops the run. Re-running the same period returns the stored run; an overlapping period is refused. Present totals per client, per currency.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
