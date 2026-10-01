---
description: "Stock by SKU: on hand, allocated to open orders, available"
---
# Stock by SKU: on hand, allocated to open orders, available

Read CLAUDE.md first. Run `npm run fulfil -- stock`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Negative available means open orders want more than the shelves hold. Use `bin-stock` for bin-level detail.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
