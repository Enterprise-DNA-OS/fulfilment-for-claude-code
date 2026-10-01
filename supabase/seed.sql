-- Fictional demo data for Fulfilment for Claude Code. Never seed a real database.
-- Dates are relative to the day you seed, so the attention and compliance reads always have something to say.
-- Idempotent: fixed ids, on conflict do nothing. Re-seeding keeps anything you changed.

insert into clients (id, name, currency, order_fee_cents, item_fee_cents, bin_week_cents, return_fee_cents, despatch_days, personal_data_days) values
('10000000-0000-0000-0000-000000000001', 'Tide and Tonic', 'NZD', 395, 60, 250, 450, 1, 365),
('10000000-0000-0000-0000-000000000002', 'Kiwi Kicks', 'NZD', 425, 75, 300, 550, 2, 365),
('10000000-0000-0000-0000-000000000003', 'Bondi Bean Co', 'AUD', 380, 55, 280, null, 1, null)
on conflict do nothing;

insert into products (id, client_id, sku, name, weight_kg, barcode, dangerous_goods, reorder_point) values
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'TT-SERUM-30', 'Hydrating serum 30 ml', 0.120, '9400000000011', false, 20),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'TT-MIST-100', 'Face mist aerosol 100 ml', 0.180, '9400000000028', true, 12),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'KK-RUN-42', 'Trail runner size 42', 0.950, '9400000000035', false, 6),
('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'KK-SOCK-3P', 'Merino socks three pack', 0.200, '9400000000042', false, 30),
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'BB-ESP-1KG', 'Espresso beans 1 kg', 1.050, '9300000000019', false, 15),
('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'BB-GRIND-USB', 'Rechargeable hand grinder', 0.600, '9300000000026', true, 4)
on conflict do nothing;

insert into bins (id, name, zone) values
('30000000-0000-0000-0000-000000000001', 'A-01-01', 'Pick face'),
('30000000-0000-0000-0000-000000000002', 'A-01-02', 'Pick face'),
('30000000-0000-0000-0000-000000000003', 'B-02-01', 'Bulk'),
('30000000-0000-0000-0000-000000000004', 'DG-01', 'Dangerous goods cage'),
('30000000-0000-0000-0000-000000000005', 'RET-01', 'Returns')
on conflict do nothing;

insert into stock (id, product_id, bin_id, quantity) values
('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 18),
('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 60),
('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 12),
('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 1),
('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 44),
('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 16),
('40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000004', 9)
on conflict do nothing;

insert into movements (id, product_id, bin_id, kind, quantity, occurred_on, note)
select id, product_id, bin_id, 'receipt', quantity, current_date - 20, 'Demo opening stock' from stock
where id::text like '40000000-%' and quantity > 0
on conflict do nothing;

insert into courier_services (id, name, carrier, accepts_dg) values
('50000000-0000-0000-0000-000000000001', 'Standard Parcel', 'Demo Carrier', false),
('50000000-0000-0000-0000-000000000002', 'Overnight Parcel', 'Demo Carrier', false),
('50000000-0000-0000-0000-000000000003', 'Road DG', 'Demo Freight', true)
on conflict do nothing;

insert into asns (id, name, client_id, expected_on, received_on, note) values
('60000000-0000-0000-0000-000000000001', 'ASN-KK-0912', '10000000-0000-0000-0000-000000000002', current_date - 3, null, '120 pairs of trail runners from the importer'),
('60000000-0000-0000-0000-000000000002', 'ASN-BB-0930', '10000000-0000-0000-0000-000000000003', current_date + 2, null, 'Roasted beans, two pallets')
on conflict do nothing;

insert into orders (id, client_id, number, channel, ordered_on, required_by, status, hold_reason, held_on, recipient_name, recipient_email, address, postcode, country, courier_service_id, tracking, parcels, picked_on, despatched_on) values
-- open, late
('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'TT-1041', 'Shopify', current_date - 3, current_date - 2, 'open', null, null, 'Aroha Demo', 'aroha@example.com', '12 Example Street, Ponsonby, Auckland', '1011', 'NZ', null, null, null, null, null),
-- open, due today, ready
('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'TT-1042', 'Shopify', current_date, current_date, 'open', null, null, 'Ben Sample', 'ben@example.com', '4 Test Road, Riccarton, Christchurch', '8011', 'NZ', null, null, null, null, null),
-- open, short stock (two runners wanted, one on the shelf)
('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'KK-5520', 'Marketplace', current_date - 1, current_date + 1, 'open', null, null, 'Cara Placeholder', 'cara@example.com', '88 Demo Avenue, Te Aro, Wellington', '6011', 'NZ', null, null, null, null, null),
-- on hold four days: address query
('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'KK-5517', 'Shopify', current_date - 5, current_date - 3, 'on_hold', 'Address does not match postcode', current_date - 4, 'Dev Example', 'dev@example.com', '1 Nowhere Lane, Hamilton', '9999', 'NZ', null, null, null, null, null),
-- picked, waiting for the courier
('70000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'BB-3310', 'WooCommerce', current_date, current_date + 1, 'picked', null, null, 'Ella Test', 'ella@example.com', '7 Sample Parade, Bondi NSW', '2026', 'AU', null, null, null, current_date, null),
-- despatched on time last week
('70000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'TT-1030', 'Shopify', current_date - 8, current_date - 7, 'despatched', null, null, 'Finn Demo', 'finn@example.com', '22 Example Crescent, Mt Maunganui', '3116', 'NZ', '50000000-0000-0000-0000-000000000001', 'DEMO000001NZ', 1, current_date - 7, current_date - 7),
-- despatched late last week
('70000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'KK-5490', 'Marketplace', current_date - 10, current_date - 8, 'despatched', null, null, 'Gina Sample', 'gina@example.com', '5 Test Terrace, Dunedin', '9016', 'NZ', '50000000-0000-0000-0000-000000000002', 'DEMO000002NZ', 1, current_date - 6, current_date - 6),
-- despatched with a dangerous good on a service not marked for them
('70000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'TT-1022', 'Shopify', current_date - 12, current_date - 11, 'despatched', null, null, 'Hemi Example', 'hemi@example.com', '9 Demo Street, Napier', '4110', 'NZ', '50000000-0000-0000-0000-000000000002', 'DEMO000003NZ', 1, current_date - 11, current_date - 11),
-- despatched fourteen months ago: recipient details past the client's retention period
('70000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 'KK-4012', 'Shopify', current_date - 430, current_date - 428, 'despatched', null, null, 'Isla Placeholder', 'isla@example.com', '31 Sample Road, Nelson', '7010', 'NZ', '50000000-0000-0000-0000-000000000001', 'DEMO000004NZ', 1, current_date - 428, current_date - 428)
on conflict do nothing;

insert into order_lines (id, order_id, product_id, quantity) values
('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2),
('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 1),
('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 1),
('71000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 2),
('71000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 1),
('71000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 2),
('71000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 2),
('71000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 3),
('71000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', 1),
('71000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', 1),
('71000000-0000-0000-0000-000000000011', '70000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000004', 1)
on conflict do nothing;

insert into returns (id, name, order_id, product_id, quantity, reason, received_on) values
('80000000-0000-0000-0000-000000000001', 'RET-KK-5490', '70000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', 1, 'Wrong size', current_date - 8)
on conflict do nothing;

insert into charge_runs (id, name, period_from, period_to, status, approved_by, retain_until) values
('90000000-0000-0000-0000-000000000001', 'BILL-DEMO-AUGUST', current_date - 60, current_date - 31, 'approved', 'Accounts (demo)', current_date + 700)
on conflict do nothing;

insert into charge_lines (id, run_id, client_id, currency, kind, units, rate_cents, amount_cents) values
('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'NZD', 'orders', 212, 395, 83740),
('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'NZD', 'orders', 148, 425, 62900)
on conflict do nothing;

insert into notes (id, client_id, note, recorded_on) values
('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Asked for gift notes on every Shopify order over two items', current_date - 9),
('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Return rate not agreed yet: chase before the next bill', current_date - 40)
on conflict do nothing;
