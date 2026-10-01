# Fulfilment for Claude Code

Orders, bin stock, returns and client billing for an e-commerce fulfilment warehouse, in a database you own. The open-source alternative to Mintsoft. Built by Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. Install and try the demo. | Your rates, your rules, your Mintsoft data brought across, scanner screens and shop connections. [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=mintsoft). | Installed and operated through **Omni by Enterprise DNA**. One setup fee, then a retainer. [See the offer](https://enterprisedna.co/omni/instead-of/mintsoft?utm_source=github&utm_medium=readme&utm_campaign=mintsoft). |

## Instead of Mintsoft

Mintsoft's Australian price list starts its 3PL plans at $1,249 a month (Starter, up to 1,000 orders, and Small, about 3,000), then $1,688 for about 5,000, $2,404 for about 8,000 and $2,669 for about 13,000: $14,988 to $32,028 a year before add-ons ([Mintsoft pricing](https://www.theaccessgroup.com/en-au/products/mintsoft/mintsoft-pricing/), checked 1 October 2026; the page says "from" and does not name the currency or tax). This repo is for the 3PL or brand that picks, packs and despatches online orders for several clients, and wants the records and the billing in its own hands.

## Start here

```bash
git clone https://github.com/Enterprise-DNA-OS/fulfilment-for-claude-code.git
cd fulfilment-for-claude-code
npm install
npm run demo
npm test
npm run view
npm run docs
```

Node 20 or newer. The embedded database needs no server. Then open the folder in Claude Code and type `/pick-wave`, then `/attention`. Demo dates are relative to the day you first seed. Re-seeding keeps your changes; for a fresh demo use a new `DATA_DIR`. For a shared database set `DATABASE_URL` (Postgres, Supabase, Neon) and run `npm run migrate`. Never seed real records.

## What is included

Thirteen record types: clients, SKUs, bins, bin stock, courier services, delivery notices, orders, order lines, returns, the stock ledger, billing runs, billing lines and client notes. The demo is a fictional 3PL with three brands, and it deliberately has a late order, a short SKU, an order on hold for four days, an overdue delivery, a return waiting a week, a client without agreed rates, a dangerous good sent on the wrong service, a billing run with a short retention date and shopper details kept past their period.

The working day: `/pick-wave` lists open orders, ready first. `/pick` takes stock from the fullest bin first and writes the ledger in the same transaction. `/despatch` records service, tracking and parcels, and refuses a dangerous goods order on a service not marked for it. `/hold`, `/release` and `/cancel` (a picked order goes back to its bins). `/receive` books goods in against a delivery notice. `/return`, `/restock` and `/write-off` close the loop.

The money: each client has an order fee, a fee per item after the first, a weekly bin rate and a return fee. `/bill` drafts a run for a period ending today, refuses overlapping periods and missing rates, and keeps the run for seven years. `/approve-bill` records who checked it. These are charge records for review; your accounts system issues the invoice.

## Commands

Each command is an agent recipe over one CLI, `npm run fulfil -- <command>`. Reads print a table, or JSON with `--json`. Names match without case; partial names and ids work when unique. An ambiguous name lists the candidates and exits 1.

| Command | Job |
|---|---|
| /add | Add a client, SKU, bin, courier service or delivery notice |
| /adjust | Correct a bin count with a reason |
| /approve-bill | Record approval of a checked billing run |
| /attention | What needs action now: late, blocked, low, overdue, unbilled |
| /bill | Draft a billing run for a period ending today |
| /bin-stock | Stock by bin |
| /bins | Bins with SKU and unit counts |
| /cancel | Cancel an order; picked stock goes back to its bins |
| /charges | Stored billing lines by run and client |
| /client-review | Every client side by side: open, late, low stock, returns, last note |
| /client | One client: stock, open orders, despatch and notes |
| /clients | Clients, their rates, agreed despatch days and retention |
| /compliance | Retention of shopper details and billing records, dangerous goods services |
| /couriers | Courier services and whether they accept dangerous goods |
| /customise | A tested migration for your fields or rules |
| /despatch | Record despatch with courier service, tracking and parcels |
| /draft-client-report | Draft a client's fulfilment report for review |
| /export | Export every record to one JSON file |
| /hold | Put an open order on hold with a reason |
| /import | Bring products and order history across from Mintsoft |
| /inbound | Delivery notices: expected, received and overdue |
| /late | Orders past their required date |
| /log | Record a note against a client |
| /low-stock | SKUs at or below their reorder point |
| /movements | The stock ledger: receipts, picks, returns and adjustments |
| /new-order | Enter a manual order |
| /new-view | A read-only report in your brand |
| /notes | Client notes |
| /order | One order: lines, recipient, courier and returns |
| /orders | Every order with its status, despatch check and courier |
| /pick-wave | Today's pick wave: open orders, ready first, then by required date |
| /pick | Pick one order from its bins and deduct the stock |
| /privacy-due | Orders whose recipient details have passed the client's retention period |
| /products | SKUs by client |
| /receive | Book goods in to a bin, against a delivery notice if there is one |
| /redact | Clear recipient details past the retention period |
| /release | Release a held order back to the pick wave |
| /restock | Put a returned item back into a bin |
| /return | Log a customer return against a despatched order |
| /returns | Returns received and what happened to them |
| /set | Correct a client, SKU, bin, courier service, delivery notice or billing retention date |
| /sla | Despatch against each client's agreed days, last 28 days |
| /stock | Stock by SKU: on hand, allocated to open orders, available |
| /storage-run | This week's storage: occupied bins at each client's rate |
| /to-despatch | Picked orders waiting for the courier |
| /weekly-review | Monday review of the fulfilment week, written from four reads |
| /write-off | Write off a returned item that cannot be resold |

## Documents and views

`npm run docs` writes packing slips, client fulfilment statements, client stock reports and returns notes under `docs-out/`. `npm run view` writes the week, attention, stock and billing dashboards under `views/`. Edit `brand.json` for your business name, colours and logo. Open in a browser or print to PDF. Nothing sends.

## Ten questions to ask your own records

Each is answered by a command in this repo today.

1. Which orders will miss their required date, and what is holding each one? (`late`)
2. Which SKUs are oversold across open orders? (`attention`)
3. Which clients fell below their agreed despatch days in the last four weeks? (`sla`)
4. Which SKUs need reordering, grouped by client? (`low-stock`)
5. Which inbound deliveries are late, and which open orders are short until they land? (`attention`)
6. Which picked orders carry dangerous goods, and which services can take them? (`to-despatch`)
7. What does each client owe this period for orders, extra items, storage and returns? (`bill`)
8. Which returns have waited more than five days for a decision? (`attention`)
9. Whose shopper details are past the agreed retention period? (`privacy-due`)
10. Which clients have late orders, low stock and no note this month? (`client-review`)

## Your first hour: ten things to ask for

1. Put our name and logo on the packing slips.
2. Preview this Mintsoft product export for Tide and Tonic.
3. Import it, then mark the aerosols as dangerous goods.
4. Add our bins and courier services, and say which take dangerous goods.
5. Enter each client's agreed rates and despatch days.
6. Book in this morning's stock count.
7. Show today's pick wave and pick the first three orders.
8. Draft this month's report for our biggest client.
9. Set a 12 month retention period for shopper details and show what is due.
10. Add a gift message field to orders with a tested migration.

## Switching and compliance

The [replacement guide](docs/replace-mintsoft.md) covers the product import, the order history import from Mintsoft's bulk export, and what does not come across (live shop feeds, labels, the client portal). The [record checks](docs/compliance.md) cite NZ and AU sources for keeping shopper details and billing records, and say plainly what is policy rather than law. [Why no front end](docs/why-no-front-end.md) is honest about what a screen gives you.

## Validation

`npm test` runs on a temporary database and checks every read, every write and its guard, the ledger against the shelves, billing sums, repeat runs, both imports, redaction, seed idempotence and the rendered HTML. CI runs it on Windows and Linux and against a real Postgres.

MIT. Copyright 2026 Enterprise DNA.
