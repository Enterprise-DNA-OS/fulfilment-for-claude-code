---
description: "Orders past their required date"
---
# Orders past their required date

Read CLAUDE.md first. Run `npm run fulfil -- late`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Say why each is late (on hold, short stock, not picked) and the next action. Draft a client note with `/log` only when the operator asks.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
