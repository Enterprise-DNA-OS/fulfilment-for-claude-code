# Replace Mintsoft

Checked 1 October 2026 against Mintsoft's help centre: [Export orders in bulk](https://help-mintsoft.theaccessgroup.com/en/articles/11579653-export-orders-in-bulk) and the product upload guide (Products > Extras > Upload Products, where StockCode, Name and Weight are the columns a first upload needs). Example files in `examples/` are fictional and use those names. Mintsoft's article lists the exported fields rather than the exact header text, so check the first line of your own file: the importer accepts the common spellings (`Order Number` or `OrderNumber`, `Post Code` or `Postcode`) and tells you which column it could not find.

## 1. Products, one client at a time

Export each client's products from Mintsoft as CSV. Mintsoft asks for the client on its upload screen rather than in a column, so this importer does the same.

```bash
npm run migrate
npm run fulfil -- import mintsoft-products /path/to/products.csv --client="Tide and Tonic" --dry-run
npm run fulfil -- import mintsoft-products /path/to/products.csv --client="Tide and Tonic"
```

| Mintsoft column | Here |
|---|---|
| StockCode | SKU (unique per client) |
| Name | Product name |
| Weight | Weight in kg |
| EAN, Barcode or UPC | Barcode |
| Every other column | Kept as it was in `source_record` for later mapping |

Repeat imports update the name, weight and barcode without making duplicates. Products missing from the file are not deleted. After import, set reorder points and mark dangerous goods SKUs with `set products`: Mintsoft's file does not tell this importer either.

## 2. Order history

In Mintsoft go to Orders > Overview, show 1000 records per page, tick the orders, choose Export Orders to CSV in Bulk Actions and press Go. Mintsoft exports 1000 at a time; for more, run it per date range or use one of its reports with the same columns.

```bash
npm run fulfil -- import mintsoft-orders /path/to/orders.csv --dry-run
npm run fulfil -- import mintsoft-orders /path/to/orders.csv
```

| Mintsoft field | Here |
|---|---|
| Client | Client, created if new (without rates). On a single-brand account pass `--client=` |
| Order Number | Order number, unique per client |
| Order Date, Required Despatch Date, Despatch Date | Ordered, required by and despatched dates. Day-first dates such as 24/09/2026 14:05 are read as 24 September |
| Order Status | Despatched, Cancelled and On Hold map across; anything else becomes open |
| First and Last Name, Company Name, Address 1 to 3, Town, County, Post Code, Phone, Email, Country | Recipient |
| Courier Service, Tracking Number, Number Of Parcels | Courier service (created if new, not marked for dangerous goods), tracking and parcels |
| Channel or Source | Channel |
| Order Items and every other column | Kept in `source_record` |

Mintsoft puts an order's items in one Order Items field, so order lines are not created from this file. Despatched history still counts for despatch performance and the retention check. Open orders show in `attention` as "Open order without lines": finish them in Mintsoft before the switch, or ask Claude Code to map their items to SKUs.

## 3. Stock, rates and the switch

Bin stock is counted, not imported. Book each bin with `receive` from a stock count on switch day, or adjust after a count. Enter each client's agreed rates with `set clients`: order fee, fee per extra item, weekly bin rate and return fee, all in cents. Then run one billing period in parallel with Mintsoft and compare the totals before you rely on it. This base charges per despatched order, per item after the first, per occupied bin per started week and per processed return. It does not reproduce every Mintsoft billing rule, minimum or courier recharge.

Not carried across: live marketplace and shop connections, courier label printing, scanner app settings, the client portal, user logins and Mintsoft's audit history. Enterprise DNA maps the rest of your exports, connects your shops and couriers, and builds the screens your packers need: [book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=mintsoft).
