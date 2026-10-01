---
description: "Every order with its status, despatch check and courier"
---
# Every order with its status, despatch check and courier

Read CLAUDE.md first. Run `npm run fulfil -- orders`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Filter on request (one client, one status, this week). Use `order <number>` for one order's lines, recipient and returns.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
