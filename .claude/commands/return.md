---
description: "Log a customer return against a despatched order"
---
# Log a customer return against a despatched order

Read CLAUDE.md first. Run `npm run fulfil -- return --order=<number> --sku=<code> --quantity=N --reason=<text>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. The command checks the quantity against what was sent.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
