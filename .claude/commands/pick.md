---
description: "Pick one order from its bins and deduct the stock"
---
# Pick one order from its bins and deduct the stock

Read CLAUDE.md first. Run `npm run fulfil -- pick <order>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Confirm the order number first with `order <number>`. Report each SKU and the bin it came from. If it fails on short stock, show the SKU's stock and the attention list; never adjust stock to force a pick.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
