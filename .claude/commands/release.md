---
description: "Release a held order back to the pick wave"
---
# Release a held order back to the pick wave

Read CLAUDE.md first. Run `npm run fulfil -- release <order>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Confirm what resolved the hold and log it with `/log` against the client.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
