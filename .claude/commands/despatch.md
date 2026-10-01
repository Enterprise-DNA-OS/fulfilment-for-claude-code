---
description: "Record despatch with courier service, tracking and parcels"
---
# Record despatch with courier service, tracking and parcels

Read CLAUDE.md first. Run `npm run fulfil -- despatch <order> --service=<name> --tracking=<ref> [--parcels=N]`. Add `--json` when you need to work with the rows. Read the affected records before any write, ask the operator when a name matches more than one record, and never invent a quantity, rate, tracking reference or approval. Take the tracking reference from the courier label or the operator, never invent one. If the order holds dangerous goods and the service is not marked as accepting them, the command refuses: offer a service that is.

Present the answer as a short table and one line on what to do next. Drafts stay in drafts/. Nothing sends.
