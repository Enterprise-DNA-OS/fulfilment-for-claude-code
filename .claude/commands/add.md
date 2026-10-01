---
description: "Add a client, SKU, bin, courier service or delivery notice"
---
# Add a client, SKU, bin, courier service or delivery notice

Read CLAUDE.md first. Run `npm run fulfil -- add <clients|products|bins|courier_services|asns> --data=<file.json>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Write the JSON to a temp file with only the fields in scripts/lib/domain.mjs. Rates are in cents.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
