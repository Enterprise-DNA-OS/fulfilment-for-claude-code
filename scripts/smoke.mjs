#!/usr/bin/env node
// npm test: a temporary database, migrate, seed twice, then every command and every guard.
// TEST_DATABASE_URL runs the same checks in a throwaway schema on a real Postgres.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, reads, resolve, format, exportDate } from './fulfil.mjs';
import { parseCsv } from './lib/csv.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fulfil-test-'));
const testUrl = process.env.TEST_DATABASE_URL || '';
const schema = 'fulfil_test_' + Date.now();
process.env.DATABASE_URL = '';
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
let db, checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };
const fail = async (fn, re) => { await assert.rejects(fn, re); checks++; };
const file = (n, v) => { const p = path.join(temp, n); fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v)); return p; };
const cli = (s, args = [], status = 0) => { const p = spawnSync(process.execPath, [s, ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' }); assert.equal(p.status, status, p.stderr || p.stdout); checks++; return p.stdout; };
const q1 = async (sql, p = []) => (await db.query(sql, p))[0];

try {
  if (testUrl) {
    process.env.DATABASE_URL = testUrl;
    const admin = await getDb();
    try { await admin.exec(`create schema ${schema}`); } finally { await admin.close(); }
    const u = new URL(testUrl); u.searchParams.set('options', '-c search_path=' + schema); process.env.DATABASE_URL = u.toString();
  }
  db = await getDb();
  eq((await migrate(db)).ran.length, 1, 'fresh migration');
  eq((await migrate(db)).ran.length, 0, 'repeat migrate is a no-op');
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8');
  await db.exec(seed); await db.exec(seed);
  eq((await db.query('select * from orders')).length, 9, 'seed idempotent');

  // Every read runs and formats.
  for (const key of Object.keys(reads)) { const rows = await run(db, [key]); ok(Array.isArray(rows), key); ok(format(rows).length > 0, 'format ' + key); }
  const today = (await q1('select current_date::text as d')).d;
  ok((await run(db, ['help'])).length > 40, 'help lists every command');

  // The demo has something to say.
  const attention = await run(db, ['attention']);
  for (const issue of ['Late order', 'Short stock blocks order', 'On hold over 2 days', 'Oversold SKU', 'Below reorder point', 'Inbound overdue', 'Return waiting over 5 days', 'Missing client rate']) ok(attention.some((r) => r.issue === issue), 'attention: ' + issue);
  const compliance = await run(db, ['compliance']);
  for (const rule of ['NZ-IPP9 / AU-APP11.2', 'NZ-IRD-7Y / AU-ATO-5Y', 'POLICY-DG']) ok(compliance.some((r) => r.rule === rule), 'compliance: ' + rule);
  eq((await run(db, ['pick-wave'])).find((r) => r.number === 'KK-5520').pick_check, 'Short stock', 'pick wave flags short stock');
  eq((await run(db, ['sla'])).find((r) => r.client === 'Tide and Tonic').on_time_pct, 100, 'sla percentage');

  // Name matching.
  ok((await resolve(db, 'clients', 'TIDE')).endsWith('001'), 'case-insensitive partial name');
  await fail(() => resolve(db, 'clients', '10000000'), /Ambiguous/);
  await fail(() => run(db, ['client', 'missing']), /Not found/);
  await fail(() => run(db, ['bogus']), /Unknown command/);
  ok((await run(db, ['client', 'kiwi'])).open_orders.length === 2, 'client detail');
  ok((await run(db, ['order', 'TT-1042'])).lines.length === 2, 'order detail');

  // New order, pick, despatch, with the guards.
  const order = ['new-order', '--client=Tide', '--number=TT-2001', '--lines=TT-SERUM-30:3,TT-MIST-100:1', '--recipient=Test Person', '--address=1 Test St, Auckland', '--postcode=1010'];
  const created = await run(db, order);
  eq(created[0].required_by > today || created[0].required_by === today, true, 'required date from agreed days');
  ok(created[0].has_dg, 'dangerous goods flagged on the order');
  await fail(() => run(db, order), /duplicate|unique/i);
  await fail(() => run(db, ['new-order', '--client=Tide', '--number=X1', '--lines=KK-RUN-42:1', '--recipient=A', '--address=B', '--postcode=1']), /Not found/);
  await fail(() => run(db, ['new-order', '--client=Tide', '--number=X2', '--lines=TT-SERUM-30:0', '--recipient=A', '--address=B', '--postcode=1']), /integer/);
  await fail(() => run(db, ['despatch', 'TT-2001', '--service=Road DG', '--tracking=T']), /pick it/);
  const before = (await q1("select on_hand from product_stock_view where sku = 'TT-SERUM-30'")).on_hand;
  const picked = await run(db, ['pick', 'TT-2001']);
  ok(picked.length >= 2, 'pick lists the bins');
  eq((await q1("select on_hand from product_stock_view where sku = 'TT-SERUM-30'")).on_hand, before - 3, 'pick deducts stock once');
  await fail(() => run(db, ['pick', 'TT-2001']), /only open orders/);
  await fail(() => run(db, ['despatch', 'TT-2001', '--service=Standard', '--tracking=T']), /Dangerous goods/);
  await run(db, ['despatch', 'TT-2001', '--service=Road DG', '--tracking=DG1', '--parcels=2']);
  eq((await q1("select status from orders where number = 'TT-2001'")).status, 'despatched', 'despatched');
  eq((await q1("select sum(quantity)::integer as q from movements m join orders o on o.id = m.order_id where o.number = 'TT-2001'")).q, -4, 'ledger matches the shelves');

  // Short stock cannot be picked; oversell shows.
  await fail(() => run(db, ['pick', 'KK-5520']), /Short stock/);
  eq((await q1("select status from orders where number = 'KK-5520'")).status, 'open', 'failed pick rolls back');
  eq((await q1("select on_hand from product_stock_view where sku = 'KK-RUN-42'")).on_hand, 1, 'failed pick leaves stock');

  // Receive against a delivery notice clears the short stock and the overdue notice.
  await fail(() => run(db, ['receive', '--client=Tide', '--sku=TT-SERUM-30', '--bin=A-01-01', '--quantity=1', '--asn=ASN-KK-0912']), /another client/);
  await run(db, ['receive', '--client=Kiwi', '--sku=KK-RUN-42', '--bin=A-01-02', '--quantity=12', '--asn=ASN-KK-0912']);
  ok(!(await run(db, ['attention'])).some((r) => r.reference === 'ASN-KK-0912'), 'inbound no longer overdue');
  eq((await run(db, ['pick-wave'])).find((r) => r.number === 'KK-5520').pick_check, 'Ready to pick', 'receipt frees the order');

  // Hold, release, cancel a picked order back to its bins.
  await fail(() => run(db, ['hold', 'TT-1041']), /Required/);
  await run(db, ['hold', 'TT-1041', '--reason=Customer asked to wait']);
  await fail(() => run(db, ['pick', 'TT-1041']), /on_hold/);
  await run(db, ['release', 'TT-1041']);
  await fail(() => run(db, ['release', 'TT-1041']), /not on hold/);
  const sockBefore = (await q1("select on_hand from product_stock_view where sku = 'KK-SOCK-3P'")).on_hand;
  await run(db, ['pick', 'KK-5520']);
  await run(db, ['cancel', 'KK-5520']);
  eq((await q1("select on_hand from product_stock_view where sku = 'KK-SOCK-3P'")).on_hand, sockBefore, 'cancel puts picked stock back');
  await fail(() => run(db, ['cancel', 'KK-5520']), /cannot be cancelled/);

  // Adjustments.
  await fail(() => run(db, ['adjust', '--client=Kiwi', '--sku=KK-SOCK-3P', '--bin=A-01-02', '--quantity=-999', '--reason=Count']), /below zero/);
  await run(db, ['adjust', '--client=Kiwi', '--sku=KK-SOCK-3P', '--bin=A-01-02', '--quantity=-2', '--reason=Count verified']);
  eq((await q1("select on_hand from product_stock_view where sku = 'KK-SOCK-3P'")).on_hand, sockBefore - 2, 'adjustment');

  // Returns.
  await fail(() => run(db, ['return', '--order=TT-1041', '--sku=TT-SERUM-30', '--quantity=1', '--reason=x']), /despatched/);
  await fail(() => run(db, ['return', '--order=TT-1030', '--sku=TT-SERUM-30', '--quantity=4', '--reason=x']), /sent 3/);
  const ret = await run(db, ['return', '--order=TT-1030', '--sku=TT-SERUM-30', '--quantity=1', '--reason=Leaking']);
  await run(db, ['write-off', ret[0].name, '--reason=Damaged']);
  await fail(() => run(db, ['restock', ret[0].name, '--bin=RET-01']), /already/);
  await run(db, ['restock', 'RET-KK-5490', '--bin=RET-01']);
  ok(!(await run(db, ['attention'])).some((r) => r.reference === 'RET-KK-5490'), 'processed return leaves attention');

  // Billing: rates first, one run per period, approval once, seven-year retention.
  await fail(() => run(db, ['bill', `--from=${today}`]), /Missing agreed rate/);
  await run(db, ['set', 'clients', 'Bondi', `--data=${file('rate.json', { return_fee_cents: 400, personal_data_days: 730 })}`]);
  await fail(() => run(db, ['bill', '--from=2999-01-01']), /after today/);
  const old = (await q1('select (current_date - 45)::text as d')).d;
  await fail(() => run(db, ['bill', `--from=${old}`]), /Overlaps/);
  const from = (await q1('select (current_date - 6)::text as d')).d;
  const bill = await run(db, ['bill', `--from=${from}`]);
  eq(bill.length, 12, 'four lines per client');
  const tide = bill.filter((l) => l.client === 'Tide and Tonic');
  eq(tide.find((l) => l.kind === 'orders').units, 1, 'orders despatched in the period: TT-2001 only, TT-1030 is a day before it');
  eq(tide.find((l) => l.kind === 'orders').amount_cents, 395, 'order fee');
  eq(tide.find((l) => l.kind === 'extra_items').units, 3, 'four items in TT-2001, three after the first');
  eq(tide.find((l) => l.kind === 'returns').units, 1, 'written-off return billed');
  eq(tide.find((l) => l.kind === 'storage').amount_cents, 3 * 250, 'three bins for one week');
  const again = await run(db, ['bill', `--from=${from}`]);
  ok(again[0].id && again[0].name, 'same period returns the stored run');
  const run1 = (await q1('select name, retain_until::text as r, period_to::text as p from charge_runs where period_from = $1', [from]));
  ok(run1.r >= String(Number(run1.p.slice(0, 4)) + 7) + run1.p.slice(4), 'retained seven years');
  await run(db, ['approve-bill', run1.name, '--by=Accounts']);
  await fail(() => run(db, ['approve-bill', run1.name, '--by=Other']), /already approved/);
  await fail(() => run(db, ['set', 'charge_runs', run1.name, `--data=${file('short.json', { retain_until: '2000-01-01' })}`]), /before the end/);
  await run(db, ['set', 'charge_runs', 'BILL-DEMO-AUGUST', `--data=${file('keep.json', { retain_until: '2040-01-01' })}`]);
  ok(!(await run(db, ['compliance'])).some((r) => r.rule.startsWith('NZ-IRD')), 'retention corrected');

  // Privacy: redact what is past the client's period, nothing else.
  eq((await run(db, ['redact', '--dry-run']))[0].action, 'would redact', 'dry run');
  ok((await q1("select recipient_name from orders where number = 'KK-4012'")).recipient_name !== 'Redacted', 'dry run changes nothing');
  await run(db, ['redact']);
  eq((await q1("select recipient_name, address from orders where number = 'KK-4012'")).recipient_name, 'Redacted', 'redacted');
  eq((await q1("select recipient_name from orders where number = 'TT-1030'")).recipient_name, 'Finn Demo', 'recent order kept');
  ok(!(await run(db, ['compliance'])).some((r) => r.reference === 'KK-4012'), 'privacy finding cleared');

  // Add and set, with field guards.
  await run(db, ['add', 'clients', `--data=${file('client.json', { name: 'Test Brand', order_fee_cents: 300, item_fee_cents: 50, bin_week_cents: 200, return_fee_cents: 300, personal_data_days: 365 })}`]);
  await run(db, ['add', 'products', `--data=${file('product.json', { client_id: 'Test Brand', sku: 'TB-1', name: 'Test product', reorder_point: 5 })}`]);
  await run(db, ['add', 'bins', `--data=${file('bin.json', { name: 'C-03-01', zone: 'Bulk' })}`]);
  await run(db, ['add', 'courier_services', `--data=${file('svc.json', { name: 'Test Courier', carrier: 'Test', accepts_dg: false })}`]);
  await run(db, ['add', 'asns', `--data=${file('asn.json', { name: 'ASN-TB-1', client_id: 'Test Brand', expected_on: today })}`]);
  await fail(() => run(db, ['add', 'clients', `--data=${file('bad.json', { name: 'x', id: 'bad' })}`]), /Unsupported/);
  await fail(() => run(db, ['add', 'asns', `--data=${file('baddate.json', { name: 'A', client_id: 'Test Brand', expected_on: '2026-02-30' })}`]), /Invalid date/);
  await fail(() => run(db, ['set', 'products', 'KK-SOCK-3P', `--data=${file('move.json', { client_id: 'Test Brand' })}`]), /Stock exists/);
  await run(db, ['log', '--client=Test Brand', '--note=Onboarded']);
  ok((await run(db, ['notes'])).some((n) => n.note === 'Onboarded'), 'note logged');
  const draft = await run(db, ['draft-client-report', 'Tide']);
  ok(fs.readFileSync(draft[0].file, 'utf8').includes('Not sent'), 'report is a draft');

  // Import from Mintsoft.
  const products = path.join(REPO_ROOT, 'examples/mintsoft-products.csv');
  const orders = path.join(REPO_ROOT, 'examples/mintsoft-orders.csv');
  await fail(() => run(db, ['import', 'mintsoft-products', products]), /--client/);
  eq((await run(db, ['import', 'mintsoft-products', products, '--client=Tide', '--dry-run']))[0].products, 2, 'product preview');
  const skus = (await run(db, ['products'])).length;
  await run(db, ['import', 'mintsoft-products', products, '--client=Tide']);
  await run(db, ['import', 'mintsoft-products', products, '--client=Tide']);
  eq((await run(db, ['products'])).length, skus + 1, 'one new SKU, one updated, repeat import idempotent');
  eq(Number((await q1("select weight_kg from products where sku = 'TT-SERUM-30'")).weight_kg), 0.125, 'weight updated');
  eq((await q1("select source_record from products where sku = 'TT-BALM-15'")).source_record.Price, '12.00', 'unmapped columns kept');
  const preview = await run(db, ['import', 'mintsoft-orders', orders, '--dry-run']);
  eq(preview[0].orders, 3, 'order preview'); eq((await db.query('select * from orders')).length, 10, 'preview writes nothing');
  eq((await run(db, ['import', 'mintsoft-orders', orders]))[0].created, 3, 'orders created');
  eq((await run(db, ['import', 'mintsoft-orders', orders]))[0].updated, 3, 'repeat import updates');
  const imported = await q1("select status, despatched_on::text as d, ordered_on::text as o from orders where number = 'TT-0901'");
  eq(imported.status, 'despatched', 'status mapped'); eq(imported.d, '2026-09-03', 'day-first date'); eq(imported.o, '2026-09-02', 'order date');
  ok((await run(db, ['attention'])).some((r) => r.issue === 'Open order without lines' && r.reference === 'TT-0902'), 'imported open order flagged for mapping');
  eq((await q1("select status from orders where number = 'HS-0077'")).status, 'cancelled', 'cancelled mapped');
  await fail(() => run(db, ['import', 'mintsoft-orders', file('dup.csv', 'Client,Order Number,Order Date\nA,1,01/09/2026\nA,1,01/09/2026\n')]), /Duplicate/);
  await fail(() => run(db, ['import', 'mintsoft-orders', file('nodate.csv', 'Client,Order Number,Order Status,Order Date\nA,1,DESPATCHED,01/09/2026\n')]), /no Despatch Date/);
  await fail(() => run(db, ['import', 'other', orders]), /Supported/);
  eq(exportDate('24/09/2026 14:05'), '2026-09-24', 'export date'); assert.throws(() => exportDate('31/02/2026'), /Invalid/); checks++;
  eq(parseCsv('﻿a,b\r\n"two\nlines","a""b"\r\n')[0].b, 'a"b', 'quoted CSV');

  // Export and seed safety.
  const out = await run(db, ['export']);
  eq(Object.keys(JSON.parse(fs.readFileSync(out[0].file)).records).length, 13, 'full export');
  const kept = (await q1("select status from orders where number = 'KK-5520'")).status;
  await db.exec(seed);
  eq((await q1("select status from orders where number = 'KK-5520'")).status, kept, 'seed preserves your writes');
  await db.close(); db = null;

  // The CLI, views and documents as a person runs them.
  for (const key of Object.keys(reads)) ok(Array.isArray(JSON.parse(cli('scripts/fulfil.mjs', [key, '--json']))), 'CLI ' + key);
  cli('scripts/fulfil.mjs', ['pick-wave']);
  cli('scripts/fulfil.mjs', ['client', 'unknown'], 1);
  cli('scripts/fulfil.mjs', ['client', '10000000'], 1);
  cli('scripts/view.mjs'); cli('scripts/docs.mjs');
  ok(fs.readFileSync(path.join(temp, 'views', 'week.html'), 'utf8').includes('Southern Parcel Co'), 'branded view');
  for (const d of ['packing-slip', 'client-statement', 'stock-report', 'returns-note']) ok(fs.readdirSync(path.join(temp, 'docs-out', d)).length > 0, d + ' rendered');

  const commands = fs.readdirSync(path.join(REPO_ROOT, '.claude/commands')).filter((x) => x.endsWith('.md') && x !== 'README.md').length;
  console.log(`PASS: ${checks} checks; ${commands} agent commands; ${testUrl ? 'isolated Postgres schema' : 'temporary embedded database'}.`);
} finally {
  await db?.close();
  if (testUrl) { process.env.DATABASE_URL = testUrl; const admin = await getDb(); try { await admin.exec(`drop schema if exists ${schema} cascade`); } finally { await admin.close(); } }
  fs.rmSync(temp, { recursive: true, force: true });
}
