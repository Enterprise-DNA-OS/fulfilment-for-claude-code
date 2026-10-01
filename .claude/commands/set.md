---
description: "Correct a client, SKU, bin, courier service, delivery notice or billing retention date"
---
# Correct a client, SKU, bin, courier service, delivery notice or billing retention date

Read CLAUDE.md first. Run `npm run fulfil -- set <type> <name> --data=<file.json>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Read the record first. Moving a SKU with stock to another client is refused.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
