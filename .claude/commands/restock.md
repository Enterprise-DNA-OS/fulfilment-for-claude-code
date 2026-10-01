---
description: "Put a returned item back into a bin"
---
# Put a returned item back into a bin

Read CLAUDE.md first. Run `npm run fulfil -- restock <return> --bin=<name>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Only restock goods checked as resaleable.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
