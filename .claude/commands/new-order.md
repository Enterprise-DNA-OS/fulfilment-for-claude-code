---
description: "Enter a manual order"
---
# Enter a manual order

Read CLAUDE.md first. Run `npm run fulfil -- new-order --client=<name> --number=<ref> --lines=SKU:qty,SKU:qty --recipient=<name> --address=<text> --postcode=<code> [--country=NZ] [--email=] [--phone=] [--channel=] [--required=YYYY-MM-DD]`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Required-by defaults to the client's agreed despatch days. Read the client's SKUs with `products` first. Quote values with spaces.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
