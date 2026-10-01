---
description: "Record approval of a checked billing run"
---
# Record approval of a checked billing run

Read CLAUDE.md first. Run `npm run fulfil -- approve-bill <run> --by=<name>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Only after the operator has checked the draft lines. The name is the person approving.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
