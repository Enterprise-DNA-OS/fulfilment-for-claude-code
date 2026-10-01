# Fulfilment operating instructions

Business: fill in your fulfilment business. Demo: fictional Southern Parcel Co. Operator: the fulfilment or warehouse manager. Priorities: every order out by its required date, stock that matches the shelves, and each client billed at the agreed rate.

Read README.md, docs/replace-mintsoft.md and docs/compliance.md before real work. The database is the source of truth. Never invent a quantity, rate, tracking reference, approval or date. Read the affected records before writing. When a name matches more than one record, list them and ask. Never send email or messages: drafts stay in drafts/. Deletions, redaction, destructive migrations and writes to outside systems wait for the operator's yes in this session. Never seed a real database. Never adjust stock to force a pick.

One CLI: `npm run fulfil -- help`. Machine reads take `--json`. `add` and `set` take a JSON file with only the fields in scripts/lib/domain.mjs. Every recurring job has a recipe in .claude/commands/<name>.md, the same in Claude Code, Codex, OpenCode and Cursor. `npm run view` writes dashboards, `npm run docs` writes paperwork, and brand.json holds the business identity.

| Job | Recipe |
|---|---|
| Add a client, SKU, bin, courier service or delivery notice | /add |
| Correct a bin count with a reason | /adjust |
| Record approval of a checked billing run | /approve-bill |
| What needs action now: late, blocked, low, overdue, unbilled | /attention |
| Draft a billing run for a period ending today | /bill |
| Stock by bin | /bin-stock |
| Bins with SKU and unit counts | /bins |
| Cancel an order; picked stock goes back to its bins | /cancel |
| Stored billing lines by run and client | /charges |
| Every client side by side: open, late, low stock, returns, last note | /client-review |
| One client: stock, open orders, despatch and notes | /client |
| Clients, their rates, agreed despatch days and retention | /clients |
| Retention of shopper details and billing records, dangerous goods services | /compliance |
| Courier services and whether they accept dangerous goods | /couriers |
| A tested migration for your fields or rules | /customise |
| Record despatch with courier service, tracking and parcels | /despatch |
| Draft a client's fulfilment report for review | /draft-client-report |
| Export every record to one JSON file | /export |
| Put an open order on hold with a reason | /hold |
| Bring products and order history across from Mintsoft | /import |
| Delivery notices: expected, received and overdue | /inbound |
| Orders past their required date | /late |
| Record a note against a client | /log |
| SKUs at or below their reorder point | /low-stock |
| The stock ledger: receipts, picks, returns and adjustments | /movements |
| Enter a manual order | /new-order |
| A read-only report in your brand | /new-view |
| Client notes | /notes |
| One order: lines, recipient, courier and returns | /order |
| Every order with its status, despatch check and courier | /orders |
| Today's pick wave: open orders, ready first, then by required date | /pick-wave |
| Pick one order from its bins and deduct the stock | /pick |
| Orders whose recipient details have passed the client's retention period | /privacy-due |
| SKUs by client | /products |
| Book goods in to a bin, against a delivery notice if there is one | /receive |
| Clear recipient details past the retention period | /redact |
| Release a held order back to the pick wave | /release |
| Put a returned item back into a bin | /restock |
| Log a customer return against a despatched order | /return |
| Returns received and what happened to them | /returns |
| Correct a client, SKU, bin, courier service, delivery notice or billing retention date | /set |
| Despatch against each client's agreed days, last 28 days | /sla |
| Stock by SKU: on hand, allocated to open orders, available | /stock |
| This week's storage: occupied bins at each client's rate | /storage-run |
| Picked orders waiting for the courier | /to-despatch |
| Monday review of the fulfilment week, written from four reads | /weekly-review |
| Write off a returned item that cannot be resold | /write-off |

Built by Enterprise DNA. Installed and run for you through Omni: https://enterprisedna.co/omni/instead-of/mintsoft
