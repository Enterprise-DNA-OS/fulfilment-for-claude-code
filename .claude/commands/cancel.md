---
description: "Cancel an order; picked stock goes back to its bins"
---
# Cancel an order; picked stock goes back to its bins

Read CLAUDE.md first. Run `npm run fulfil -- cancel <order>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Despatched orders cannot be cancelled: use `/return` when goods come back. Confirm with the operator before cancelling.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
