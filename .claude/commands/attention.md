---
description: "What needs action now: late, blocked, low, overdue, unbilled"
---
# What needs action now: late, blocked, low, overdue, unbilled

Read CLAUDE.md first. Run `npm run fulfil -- attention`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Order by what costs the most if missed: late orders and short stock first, then holds, inbound, returns and missing rates. Give one next step per row.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
