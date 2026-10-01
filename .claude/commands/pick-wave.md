---
description: "Today's pick wave: open orders, ready first, then by required date"
---
# Today's pick wave: open orders, ready first, then by required date

Read CLAUDE.md first. Run `npm run fulfil -- pick-wave`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Group the ready orders by client. Call out late orders and anything flagged Short stock, No lines or Inactive SKU, and say what clears each one. Mention orders carrying dangerous goods so they go to the right service.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
