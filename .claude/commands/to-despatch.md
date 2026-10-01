---
description: "Picked orders waiting for the courier"
---
# Picked orders waiting for the courier

Read CLAUDE.md first. Run `npm run fulfil -- to-despatch`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. List by required date. Flag dangerous goods orders: they need a service marked as accepting dangerous goods (`couriers`).

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
