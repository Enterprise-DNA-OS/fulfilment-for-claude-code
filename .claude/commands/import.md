---
description: "Bring products and order history across from Mintsoft"
---
# Bring products and order history across from Mintsoft

Read CLAUDE.md first. Run `npm run fulfil -- import mintsoft-products <csv> --client=<name> [--dry-run] | import mintsoft-orders <csv> [--client=<name>] [--dry-run]`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Read docs/replace-mintsoft.md first. Always run --dry-run first and show the counts. Open orders arrive without items: map them before picking.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
