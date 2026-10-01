---
description: "Book goods in to a bin, against a delivery notice if there is one"
---
# Book goods in to a bin, against a delivery notice if there is one

Read CLAUDE.md first. Run `npm run fulfil -- receive --client=<name> --sku=<code> --bin=<name> --quantity=N [--asn=<name>]`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Quantities come from the physical count, not the delivery notice. One SKU per run; repeat for each line of the delivery.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
