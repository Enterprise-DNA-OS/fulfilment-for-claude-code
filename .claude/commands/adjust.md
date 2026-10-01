---
description: "Correct a bin count with a reason"
---
# Correct a bin count with a reason

Read CLAUDE.md first. Run `npm run fulfil -- adjust --client=<name> --sku=<code> --bin=<name> --quantity=<signed> --reason=<text>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Every adjustment needs the count evidence as the reason. The command refuses to take a bin below zero.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
