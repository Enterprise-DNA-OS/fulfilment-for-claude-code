# Why no front end

The base is a database, one command line tool and agent recipes for a fulfilment office: the pick wave, despatch, stock, returns, client billing and the record checks. Read-only HTML views show the week, the exceptions, stock and billing. Packing slips, client statements, stock reports and returns notes come from the same records.

What a screen gives that this does not:

- **Scanning at the bench.** Packers scan barcodes on a handheld or a bench scanner. This base records a pick as one command per order. A scanner screen is a custom build.
- **Courier labels.** It records the service and tracking number. It does not book a carrier or print a label.
- **Live shop feeds.** Shopify, marketplace and WooCommerce orders arrive here by import or by command. A live connection is a custom build.
- **A client portal.** Clients get a branded report or statement. They do not log in.
- **Several people at once.** The embedded database is for one operator. For a team, set `DATABASE_URL` to a secured Postgres with backups and individual logins.

Those are the parts Enterprise DNA builds into your version when you need them. What you keep: every order, SKU, bin and charge in a database you own, and any question you can put into words answered from it.

Billing runs are charge records for review, not tax invoices. Storage is counted on today's bins for each started week of the period. Approved runs are not changed through the tool; correct them with a reviewed adjustment in your accounts.
