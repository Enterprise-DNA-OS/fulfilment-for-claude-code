---
description: "One order: lines, recipient, courier and returns"
---
# One order: lines, recipient, courier and returns

Read CLAUDE.md first. Run `npm run fulfil -- order <number>`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. If the number is ambiguous across clients, show the candidates and ask which client.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
