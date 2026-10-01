#!/usr/bin/env node
// The one CLI for Fulfilment for Claude Code. Every slash command in .claude/commands runs this.
//
//   npm run fulfil -- help              every command and its options
//   npm run fulfil -- pick-wave         reads print a table; add --json for machines
//
// Names match without case; partial ids and names work when they are unique. An ambiguous
// name lists the candidates and exits 1. Every write that moves stock is one transaction
// with its movement row, so the ledger and the shelves never disagree.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { fields, nameColumn, tables } from './lib/domain.mjs';
import { parseCsv, pick } from './lib/csv.mjs';

export const reads = {
  clients: 'select name, currency, order_fee_cents, item_fee_cents, bin_week_cents, return_fee_cents, despatch_days, personal_data_days from clients order by name',
  products: 'select client, sku, product, dangerous_goods, reorder_point, active from product_stock_view order by client, sku',
  bins: 'select b.name as bin, b.zone, count(s.id) filter (where s.quantity > 0)::integer as skus, coalesce(sum(s.quantity), 0)::integer as units from bins b left join stock s on s.bin_id = b.id group by b.id order by b.name',
  couriers: 'select name, carrier, accepts_dg from courier_services order by name',
  stock: 'select client, sku, product, on_hand, allocated, available, reorder_point, bins from product_stock_view where active order by client, sku',
  'bin-stock': 'select bin, zone, client, sku, product, quantity from bin_stock_view where quantity > 0 order by bin, client, sku',
  'low-stock': 'select client, sku, product, on_hand, allocated, available, reorder_point from product_stock_view where active and reorder_point > 0 and available <= reorder_point order by available, client, sku',
  orders: 'select client, number, channel, ordered_on, required_by, status, items, sla, pick_check, courier_service, tracking from order_view order by required_by, client, number',
  'pick-wave': "select client, number, required_by, lines, items, has_dg, sla, pick_check from order_view where status = 'open' order by (pick_check = 'Ready to pick') desc, required_by, client, number",
  'to-despatch': "select client, number, required_by, items, has_dg, sla from order_view where status = 'picked' order by required_by, client, number",
  late: "select client, number, ordered_on, required_by, status, pick_check from order_view where sla = 'Late' order by required_by, client",
  inbound: 'select a.name as asn, c.name as client, a.expected_on, a.received_on, a.note from asns a join clients c on c.id = a.client_id order by a.received_on nulls first, a.expected_on',
  returns: 'select r.name as return, c.name as client, o.number as order_number, p.sku, r.quantity, r.reason, r.received_on, r.outcome, r.processed_on from returns r join orders o on o.id = r.order_id join clients c on c.id = o.client_id join products p on p.id = r.product_id order by r.outcome = \'pending\' desc, r.received_on',
  sla: 'select client, despatch_days, despatched_28d, on_time_28d, late_28d, on_time_pct, late_now from sla_view order by client',
  'storage-run': 'select client, currency, bins, bin_week_cents, amount_cents from storage_view order by client',
  charges: 'select r.name as run, r.period_from, r.period_to, r.status, c.name as client, l.currency, l.kind, l.units, l.rate_cents, l.amount_cents from charge_lines l join charge_runs r on r.id = l.run_id join clients c on c.id = l.client_id order by r.period_to desc, c.name, l.kind',
  attention: 'select issue, reference, client, detail from attention_view order by issue, client, reference',
  compliance: 'select rule, reference, client, finding from compliance_view order by rule, reference',
  'privacy-due': 'select client, number, despatched_on, personal_data_days, keep_until from privacy_due_view order by keep_until',
  movements: 'select m.occurred_on, c.name as client, p.sku, b.name as bin, m.kind, m.quantity, m.note from movements m join products p on p.id = m.product_id join clients c on c.id = p.client_id left join bins b on b.id = m.bin_id order by m.created_at desc, m.occurred_on desc limit 200',
  notes: 'select c.name as client, n.recorded_on, n.note from notes n join clients c on c.id = n.client_id order by n.recorded_on desc',
  'client-review': `select c.name as client, c.currency,
    (select count(*) from orders o where o.client_id = c.id and o.status in ('open','on_hold','picked'))::integer as open_orders,
    s.late_now, s.on_time_pct,
    (select count(*) from product_stock_view p where p.client_id = c.id and p.reorder_point > 0 and p.available <= p.reorder_point)::integer as low_skus,
    (select count(*) from returns r join orders o on o.id = r.order_id where o.client_id = c.id and r.outcome = 'pending')::integer as pending_returns,
    (select max(recorded_on) from notes n where n.client_id = c.id) as last_note
    from clients c join sla_view s on s.client_id = c.id order by c.name`,
};

const syntax = [
  ...Object.keys(reads),
  'client <name>', 'order <number>',
  'add <clients|products|bins|courier_services|asns> --data=file.json',
  'set <clients|products|bins|courier_services|asns|charge_runs> <name> --data=file.json',
  'new-order --client=name --number=ref --lines=SKU:qty,SKU:qty --recipient=name --address=text --postcode=code [--country=NZ] [--email=] [--phone=] [--channel=] [--ordered=YYYY-MM-DD] [--required=YYYY-MM-DD]',
  'pick <order>',
  'despatch <order> --service=name --tracking=ref [--parcels=N]',
  'hold <order> --reason=text', 'release <order>', 'cancel <order>',
  'receive --client=name --sku=code --bin=name --quantity=N [--asn=name]',
  'adjust --client=name --sku=code --bin=name --quantity=signed-integer --reason=text',
  'return --order=number --sku=code --quantity=N --reason=text [--name=ref]',
  'restock <return> --bin=name', 'write-off <return> --reason=text',
  'redact [--dry-run]',
  'bill --from=YYYY-MM-DD', 'approve-bill <run> --by=name',
  'log --client=name --note=text',
  'draft-client-report <client>',
  'import mintsoft-products <csv> --client=name [--dry-run]',
  'import mintsoft-orders <csv> [--client=name] [--dry-run]',
  'export', 'help',
];

// ------------------------------------------------------------------ helpers

const flag = (args, k) => args.find((a) => a.startsWith('--' + k + '='))?.slice(k.length + 3);
function required(v, label) { if (v === undefined || v === null || String(v).trim() === '') throw Error('Required: ' + label); return String(v).trim(); }
function integer(v, label, { signed = false } = {}) {
  required(v, label);
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n === 0 || (!signed && n < 0)) throw Error(`Expected ${signed ? 'a nonzero' : 'a positive'} integer: ${label}`);
  return n;
}
function isoDate(v, label = 'date') {
  required(v, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw Error('Invalid date: ' + v);
  return v;
}
// Mintsoft exports read as 2026-09-24, 24/09/2026 or 24/09/2026 14:05. Day first: it is a UK product.
export function exportDate(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return isoDate(`${m[1]}-${m[2]}-${m[3]}`);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return isoDate(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  throw Error('Unreadable date: ' + s);
}

export async function resolve(db, t, q, { where = '', params = [] } = {}) {
  const col = nameColumn[t];
  if (!col) throw Error('Unknown record type: ' + t);
  required(q, t + ' name or id');
  const extra = where ? ' and ' + where : '';
  const p = [q, ...params];
  let rows = await db.query(`select id, ${col} as name from ${t} where (id::text = $1 or lower(${col}) = lower($1))${extra}`, p);
  if (!rows.length) rows = await db.query(`select id, ${col} as name from ${t} where (starts_with(id::text, lower($1)) or position(lower($1) in lower(${col})) > 0)${extra} order by ${col}`, p);
  if (rows.length !== 1) throw Error(rows.length ? `Ambiguous ${t}: ${rows.map((r) => `${r.name} (${r.id})`).join(', ')}` : `Not found: ${q}`);
  return rows[0].id;
}
const productFor = async (db, clientId, sku) => resolve(db, 'products', sku, { where: 'client_id = $2', params: [clientId] });

async function tx(db, fn) {
  await db.exec('begin');
  try { const out = await fn(); await db.exec('commit'); return out; } catch (e) { await db.exec('rollback'); throw e; }
}
const one = async (db, t, id, lock = false) => (await db.query(`select * from ${t} where id = $1${lock ? ' for update' : ''}`, [id]))[0];
const today = async (db) => (await db.query('select current_date::text as d'))[0].d;
function writeFile(dir, name, value) {
  const base = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, dir);
  fs.mkdirSync(base, { recursive: true });
  const file = path.join(base, name);
  fs.writeFileSync(file, value);
  return file;
}

export function format(rows) {
  if (!Array.isArray(rows)) return JSON.stringify(rows, null, 2);
  if (!rows.length) return 'No records.';
  const keys = Object.keys(rows[0]);
  const str = (v) => (v instanceof Date ? v.toISOString() : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => str(r[k]).length)));
  return [keys.map((k, i) => k.padEnd(widths[i])).join('  '), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map((r) => keys.map((k, i) => str(r[k]).padEnd(widths[i])).join('  ').trimEnd())].join('\n');
}

// Take stock for an order line from its bins, fullest bin first. Returns the movements written.
async function takeFromBins(db, productId, quantity, orderId, note) {
  const bins = await db.query('select id, bin_id, quantity from stock where product_id = $1 and quantity > 0 order by quantity desc, bin_id for update', [productId]);
  let left = quantity;
  for (const b of bins) {
    if (!left) break;
    const take = Math.min(left, b.quantity);
    await db.query('update stock set quantity = quantity - $1 where id = $2', [take, b.id]);
    await db.query("insert into movements (product_id, bin_id, order_id, kind, quantity, note) values ($1, $2, $3, 'pick', $4, $5)", [productId, b.bin_id, orderId, -take, note]);
    left -= take;
  }
  if (left) throw Error('Short stock: not enough on the shelves to pick this order');
}

async function putInBin(db, productId, binId, quantity) {
  const hit = await db.query('update stock set quantity = quantity + $3 where product_id = $1 and bin_id = $2 returning id', [productId, binId, quantity]);
  if (!hit.length) await db.query('insert into stock (product_id, bin_id, quantity) values ($1, $2, $3)', [productId, binId, quantity]);
}

// ------------------------------------------------------------------ commands

export async function run(db, args) {
  const [cmd, ...rest] = args;
  const f = (k) => flag(rest, k);
  if (!cmd || cmd === 'help') return syntax.map((command) => ({ command }));
  if (reads[cmd]) return db.query(reads[cmd]);

  if (cmd === 'client') {
    const id = await resolve(db, 'clients', rest[0]);
    return {
      client: await one(db, 'clients', id),
      stock: await db.query('select sku, product, on_hand, allocated, available from product_stock_view where client_id = $1 order by sku', [id]),
      open_orders: await db.query("select number, required_by, status, items, sla, pick_check from order_view where client_id = $1 and status in ('open','on_hold','picked') order by required_by", [id]),
      sla: await db.query('select * from sla_view where client_id = $1', [id]),
      notes: await db.query('select recorded_on, note from notes where client_id = $1 order by recorded_on desc limit 5', [id]),
    };
  }

  if (cmd === 'order') {
    const id = await resolve(db, 'orders', rest[0]);
    return {
      order: (await db.query('select * from order_view where id = $1', [id]))[0],
      recipient: (await db.query('select recipient_name, recipient_email, recipient_phone, address, postcode, country, redacted_on from orders where id = $1', [id]))[0],
      lines: await db.query('select p.sku, p.name as product, l.quantity, p.dangerous_goods from order_lines l join products p on p.id = l.product_id where l.order_id = $1 order by p.sku', [id]),
      returns: await db.query('select r.name, p.sku, r.quantity, r.reason, r.outcome from returns r join products p on p.id = r.product_id where r.order_id = $1', [id]),
    };
  }

  if (cmd === 'add' || cmd === 'set') {
    const t = rest[0];
    if (!fields[t] || (cmd === 'add' && t === 'charge_runs')) throw Error('Unsupported record type: ' + t);
    const data = JSON.parse(fs.readFileSync(required(f('data'), '--data'), 'utf8'));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('Expected a JSON object');
    const keys = Object.keys(data);
    if (!keys.length || keys.some((k) => !fields[t].includes(k))) throw Error(`Unsupported or empty fields. ${t} accepts: ${fields[t].join(', ')}`);
    for (const k of keys) {
      if ((k.endsWith('_on') || k === 'retain_until') && data[k] !== null) isoDate(data[k], k);
      if (k === 'client_id') data[k] = await resolve(db, 'clients', data[k]);
    }
    if (cmd === 'add') return db.query(`insert into ${t} (${keys.join(', ')}) values (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, keys.map((k) => data[k]));
    const id = await resolve(db, t, rest[1]);
    if (t === 'products' && 'client_id' in data && (await db.query('select 1 from stock where product_id = $1 and quantity > 0 limit 1', [id])).length) throw Error('Stock exists: moving a SKU to another client needs a reviewed migration');
    if (t === 'charge_runs') {
      const r = await one(db, 'charge_runs', id);
      if (data.retain_until < r.period_to) throw Error('Retain-until cannot be before the end of the billing period');
    }
    return db.query(`update ${t} set ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} where id = $${keys.length + 1} returning *`, [...keys.map((k) => data[k]), id]);
  }

  if (cmd === 'new-order') return tx(db, async () => {
    const clientId = await resolve(db, 'clients', f('client'));
    const client = await one(db, 'clients', clientId);
    const lines = required(f('lines'), '--lines').split(',').map((part) => {
      const [sku, qty] = part.split(':');
      return { sku: required(sku, 'line SKU'), quantity: integer(qty, 'line quantity for ' + sku) };
    });
    if (new Set(lines.map((l) => l.sku.toLowerCase())).size !== lines.length) throw Error('A SKU appears twice: combine the quantities');
    const ordered = f('ordered') ? isoDate(f('ordered'), '--ordered') : await today(db);
    const requiredBy = f('required') ? isoDate(f('required'), '--required') : (await db.query('select ($1::date + $2::integer)::text as d', [ordered, client.despatch_days]))[0].d;
    const o = (await db.query(`insert into orders (client_id, number, channel, ordered_on, required_by, recipient_name, recipient_email, recipient_phone, address, postcode, country)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
    [clientId, required(f('number'), '--number'), f('channel') || 'Manual', ordered, requiredBy, required(f('recipient'), '--recipient'), f('email') || null, f('phone') || null, required(f('address'), '--address'), required(f('postcode'), '--postcode'), (f('country') || 'NZ').toUpperCase()]))[0];
    for (const l of lines) {
      const productId = await productFor(db, clientId, l.sku);
      if (!(await one(db, 'products', productId)).active) throw Error('Inactive SKU: ' + l.sku);
      await db.query('insert into order_lines (order_id, product_id, quantity) values ($1, $2, $3)', [o.id, productId, l.quantity]);
    }
    return db.query('select client, number, required_by, lines, items, has_dg, pick_check from order_view where id = $1', [o.id]);
  });

  if (cmd === 'pick') return tx(db, async () => {
    const id = await resolve(db, 'orders', rest[0]);
    const o = await one(db, 'orders', id, true);
    if (o.status !== 'open') throw Error(`Order is ${o.status}: only open orders are picked`);
    const lines = await db.query('select l.product_id, l.quantity, p.sku, p.active from order_lines l join products p on p.id = l.product_id where l.order_id = $1 order by p.sku', [id]);
    if (!lines.length) throw Error('Order has no lines: map its items first');
    for (const l of lines) {
      if (!l.active) throw Error('Inactive SKU: ' + l.sku);
      await takeFromBins(db, l.product_id, l.quantity, id, 'Picked for ' + o.number);
    }
    await db.query("update orders set status = 'picked', picked_on = current_date where id = $1", [id]);
    return db.query(`select p.sku, b.name as bin, -m.quantity as picked from movements m join products p on p.id = m.product_id join bins b on b.id = m.bin_id
      where m.order_id = $1 and m.kind = 'pick' order by p.sku, b.name`, [id]);
  });

  if (cmd === 'despatch') return tx(db, async () => {
    const id = await resolve(db, 'orders', rest[0]);
    const o = await one(db, 'orders', id, true);
    if (o.status !== 'picked') throw Error(`Order is ${o.status}: pick it before despatch`);
    const serviceId = await resolve(db, 'courier_services', f('service'));
    const service = await one(db, 'courier_services', serviceId);
    const dg = (await db.query('select has_dg from order_view where id = $1', [id]))[0].has_dg;
    if (dg && !service.accepts_dg) throw Error(`Dangerous goods: ${service.name} is not marked as accepting them. Use a dangerous goods service.`);
    const parcels = f('parcels') ? integer(f('parcels'), '--parcels') : 1;
    await db.query("update orders set status = 'despatched', despatched_on = current_date, courier_service_id = $1, tracking = $2, parcels = $3 where id = $4", [serviceId, required(f('tracking'), '--tracking'), parcels, id]);
    return db.query('select client, number, required_by, despatched_on, courier_service, tracking, parcels, sla from order_view where id = $1', [id]);
  });

  if (cmd === 'hold') {
    const id = await resolve(db, 'orders', rest[0]);
    const res = await db.query("update orders set status = 'on_hold', hold_reason = $1, held_on = current_date where id = $2 and status = 'open' returning number, status, hold_reason, held_on", [required(f('reason'), '--reason'), id]);
    if (!res.length) throw Error('Only open orders can be held');
    return res;
  }
  if (cmd === 'release') {
    const id = await resolve(db, 'orders', rest[0]);
    const res = await db.query("update orders set status = 'open', hold_reason = null, held_on = null where id = $1 and status = 'on_hold' returning number, status", [id]);
    if (!res.length) throw Error('Order is not on hold');
    return res;
  }

  if (cmd === 'cancel') return tx(db, async () => {
    const id = await resolve(db, 'orders', rest[0]);
    const o = await one(db, 'orders', id, true);
    if (!['open', 'on_hold', 'picked'].includes(o.status)) throw Error(`Order is ${o.status}: it cannot be cancelled`);
    if (o.status === 'picked') {
      // Put each picked unit back in the bin it came from.
      const picks = await db.query("select product_id, bin_id, -sum(quantity)::integer as qty from movements where order_id = $1 and kind in ('pick','unpick') group by product_id, bin_id having sum(quantity) < 0", [id]);
      for (const p of picks) {
        await putInBin(db, p.product_id, p.bin_id, p.qty);
        await db.query("insert into movements (product_id, bin_id, order_id, kind, quantity, note) values ($1, $2, $3, 'unpick', $4, $5)", [p.product_id, p.bin_id, id, p.qty, 'Cancelled ' + o.number + ': back to bin']);
      }
    }
    return db.query("update orders set status = 'cancelled', hold_reason = null, held_on = null where id = $1 returning number, status", [id]);
  });

  if (cmd === 'receive') return tx(db, async () => {
    const clientId = await resolve(db, 'clients', f('client'));
    const productId = await productFor(db, clientId, f('sku'));
    const binId = await resolve(db, 'bins', f('bin'));
    const qty = integer(f('quantity'), '--quantity');
    let asnId = null;
    if (f('asn')) {
      asnId = await resolve(db, 'asns', f('asn'));
      const asn = await one(db, 'asns', asnId, true);
      if (asn.client_id !== clientId) throw Error('That delivery notice belongs to another client');
      await db.query('update asns set received_on = coalesce(received_on, current_date) where id = $1', [asnId]);
    }
    await putInBin(db, productId, binId, qty);
    await db.query("insert into movements (product_id, bin_id, asn_id, kind, quantity, note) values ($1, $2, $3, 'receipt', $4, $5)", [productId, binId, asnId, qty, asnId ? 'Received against ' + f('asn') : 'Received']);
    return db.query('select client, sku, on_hand, allocated, available from product_stock_view where id = $1', [productId]);
  });

  if (cmd === 'adjust') return tx(db, async () => {
    const clientId = await resolve(db, 'clients', f('client'));
    const productId = await productFor(db, clientId, f('sku'));
    const binId = await resolve(db, 'bins', f('bin'));
    const qty = integer(f('quantity'), '--quantity', { signed: true });
    const reason = required(f('reason'), '--reason');
    const row = (await db.query('select quantity from stock where product_id = $1 and bin_id = $2 for update', [productId, binId]))[0];
    if ((row?.quantity || 0) + qty < 0) throw Error('Adjustment would take the bin below zero');
    await putInBin(db, productId, binId, qty);
    await db.query("insert into movements (product_id, bin_id, kind, quantity, note) values ($1, $2, 'adjustment', $3, $4)", [productId, binId, qty, reason]);
    return db.query('select bin, client, sku, quantity from bin_stock_view where id = (select id from stock where product_id = $1 and bin_id = $2)', [productId, binId]);
  });

  if (cmd === 'return') return tx(db, async () => {
    const orderId = await resolve(db, 'orders', f('order'));
    const o = await one(db, 'orders', orderId);
    if (o.status !== 'despatched') throw Error('Only despatched orders can come back');
    const productId = await productFor(db, o.client_id, f('sku'));
    const qty = integer(f('quantity'), '--quantity');
    const sent = (await db.query('select coalesce(sum(quantity), 0)::integer as q from order_lines where order_id = $1 and product_id = $2', [orderId, productId]))[0].q;
    const back = (await db.query('select coalesce(sum(quantity), 0)::integer as q from returns where order_id = $1 and product_id = $2', [orderId, productId]))[0].q;
    if (back + qty > sent) throw Error(`Order ${o.number} sent ${sent} of that SKU and ${back} already came back`);
    const name = f('name') || `RET-${o.number}-${back + 1}`;
    return db.query('insert into returns (name, order_id, product_id, quantity, reason) values ($1, $2, $3, $4, $5) returning name, quantity, reason, received_on, outcome', [name, orderId, productId, qty, required(f('reason'), '--reason')]);
  });

  if (cmd === 'restock' || cmd === 'write-off') return tx(db, async () => {
    const id = await resolve(db, 'returns', rest[0]);
    const r = await one(db, 'returns', id, true);
    if (r.outcome !== 'pending') throw Error('Return is already ' + r.outcome);
    if (cmd === 'restock') {
      const binId = await resolve(db, 'bins', f('bin'));
      await putInBin(db, r.product_id, binId, r.quantity);
      await db.query("insert into movements (product_id, bin_id, return_id, kind, quantity, note) values ($1, $2, $3, 'return', $4, $5)", [r.product_id, binId, id, r.quantity, 'Restocked ' + r.name]);
      return db.query("update returns set outcome = 'restocked', processed_on = current_date where id = $1 returning name, outcome, processed_on", [id]);
    }
    const reason = required(f('reason'), '--reason');
    return db.query("update returns set outcome = 'written_off', processed_on = current_date, reason = reason || '; written off: ' || $2 where id = $1 returning name, outcome, processed_on, reason", [id, reason]);
  });

  if (cmd === 'redact') {
    const due = await db.query('select id, client, number, keep_until from privacy_due_view order by keep_until');
    if (rest.includes('--dry-run') || !due.length) return due.map(({ id, ...r }) => ({ ...r, action: rest.includes('--dry-run') ? 'would redact' : 'none due' }));
    return tx(db, async () => {
      for (const d of due) await db.query("update orders set recipient_name = 'Redacted', recipient_email = null, recipient_phone = null, address = null, redacted_on = current_date where id = $1", [d.id]);
      return due.map(({ id, ...r }) => ({ ...r, action: 'redacted' }));
    });
  }

  if (cmd === 'bill') return tx(db, async () => {
    await db.exec('lock table charge_runs in share row exclusive mode');
    const from = isoDate(f('from'), '--from');
    const to = await today(db);
    if (from > to) throw Error('The billing period cannot start after today');
    const existing = await db.query('select * from charge_runs where period_from = $1 and period_to = $2', [from, to]);
    if (existing.length) return existing;
    const overlap = await db.query('select name from charge_runs where period_from <= $2 and period_to >= $1', [from, to]);
    if (overlap.length) throw Error('Overlaps an earlier billing run: ' + overlap.map((r) => r.name).join(', '));
    const missing = await db.query('select name from clients where order_fee_cents is null or item_fee_cents is null or bin_week_cents is null or return_fee_cents is null order by name');
    if (missing.length) throw Error('Missing agreed rate for ' + missing.map((c) => c.name).join(', ') + ': check attention');
    await db.exec('lock table stock, orders, order_lines, returns, clients in share mode');
    const r = (await db.query("insert into charge_runs (name, period_from, period_to, retain_until) values ($1, $2, $3, ($3::date + interval '7 years')::date) returning *", [`BILL-${from}-${to}`, from, to]))[0];
    // Orders and extra items: every order despatched in the period. An order with no mapped lines counts as one item.
    await db.query(`insert into charge_lines (run_id, client_id, currency, kind, units, rate_cents, amount_cents)
      select $1, c.id, c.currency, 'orders', count(o.id)::integer, c.order_fee_cents, (count(o.id) * c.order_fee_cents)::integer
      from clients c left join orders o on o.client_id = c.id and o.status = 'despatched' and o.despatched_on between $2 and $3 group by c.id`, [r.id, from, to]);
    await db.query(`insert into charge_lines (run_id, client_id, currency, kind, units, rate_cents, amount_cents)
      select $1, c.id, c.currency, 'extra_items', coalesce(sum(greatest(v.items - 1, 0)), 0)::integer, c.item_fee_cents, (coalesce(sum(greatest(v.items - 1, 0)), 0) * c.item_fee_cents)::integer
      from clients c left join order_view v on v.client_id = c.id and v.status = 'despatched' and v.despatched_on between $2 and $3 group by c.id`, [r.id, from, to]);
    await db.query(`insert into charge_lines (run_id, client_id, currency, kind, units, rate_cents, amount_cents)
      select $1, c.id, c.currency, 'returns', count(rt.id)::integer, c.return_fee_cents, (count(rt.id) * c.return_fee_cents)::integer
      from clients c left join orders o on o.client_id = c.id left join returns rt on rt.order_id = o.id and rt.outcome <> 'pending' and rt.processed_on between $2 and $3 group by c.id`, [r.id, from, to]);
    // Storage: bins occupied today, for each started week in the period.
    await db.query(`insert into charge_lines (run_id, client_id, currency, kind, units, rate_cents, amount_cents)
      select $1, s.client_id, s.currency, 'storage', (s.bins * ceil(($3::date - $2::date + 1) / 7.0))::integer, s.bin_week_cents, (s.bins * ceil(($3::date - $2::date + 1) / 7.0) * s.bin_week_cents)::integer
      from storage_view s`, [r.id, from, to]);
    return db.query('select c.name as client, l.currency, l.kind, l.units, l.rate_cents, l.amount_cents from charge_lines l join clients c on c.id = l.client_id where l.run_id = $1 order by c.name, l.kind', [r.id]);
  });

  if (cmd === 'approve-bill') {
    const id = await resolve(db, 'charge_runs', rest[0]);
    const res = await db.query("update charge_runs set status = 'approved', approved_by = $1 where id = $2 and status = 'draft' returning name, status, approved_by, retain_until", [required(f('by'), '--by'), id]);
    if (!res.length) throw Error('Billing run is already approved');
    return res;
  }

  if (cmd === 'log') {
    const id = await resolve(db, 'clients', f('client'));
    return db.query('insert into notes (client_id, note) values ($1, $2) returning recorded_on, note', [id, required(f('note'), '--note')]);
  }

  if (cmd === 'draft-client-report') {
    const id = await resolve(db, 'clients', rest[0]);
    const c = await one(db, 'clients', id);
    const sla = await db.query('select despatched_28d, on_time_28d, late_28d, on_time_pct, late_now from sla_view where client_id = $1', [id]);
    const stock = await db.query('select sku, product, on_hand, allocated, available, reorder_point from product_stock_view where client_id = $1 and active order by sku', [id]);
    const open = await db.query("select number, required_by, status, sla, pick_check from order_view where client_id = $1 and status in ('open','on_hold','picked') order by required_by", [id]);
    const rets = await db.query("select r.name, p.sku, r.quantity, r.reason, r.outcome from returns r join orders o on o.id = r.order_id join products p on p.id = r.product_id where o.client_id = $1 and r.received_on >= current_date - 27 order by r.received_on", [id]);
    const body = `# Fulfilment report draft: ${c.name}\n\nFor operator review. Not sent.\n\n## Despatch, last 28 days\n\n${format(sla)}\n\n## Open orders\n\n${format(open)}\n\n## Stock\n\n${format(stock)}\n\n## Returns, last 28 days\n\n${format(rets)}\n`;
    return [{ file: writeFile('drafts', `client-report-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`, body) }];
  }

  if (cmd === 'import') return importMintsoft(db, rest, f);

  if (cmd === 'export') {
    const data = { exported_at: new Date().toISOString(), records: {} };
    await db.exec('begin isolation level repeatable read');
    try { for (const t of tables) data.records[t] = await db.query(`select * from ${t} order by id`); await db.exec('commit'); } catch (e) { await db.exec('rollback'); throw e; }
    return [{ file: writeFile('exports', `fulfilment-${Date.now()}.json`, JSON.stringify(data, null, 2) + '\n'), record_types: tables.length }];
  }

  throw Error('Unknown command: ' + cmd + '. Run help.');
}

// ------------------------------------------------------------------ import from Mintsoft

const ORDER_STATUS = (s) => {
  const v = String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  if (v.startsWith('despatched') || v.startsWith('dispatched') || v === 'shipped') return 'despatched';
  if (v.startsWith('cancel')) return 'cancelled';
  if (v === 'onhold' || v === 'hold') return 'on_hold';
  return 'open';
};

async function importMintsoft(db, rest, f) {
  const kind = rest[0];
  if (!['mintsoft-products', 'mintsoft-orders'].includes(kind)) throw Error('Supported imports: mintsoft-products, mintsoft-orders');
  const rows = parseCsv(fs.readFileSync(required(rest[1], 'CSV file'), 'utf8'));
  if (!rows.length) throw Error('Empty export');
  const dry = rest.includes('--dry-run');

  if (kind === 'mintsoft-products') {
    const clientName = required(f('client'), '--client (Mintsoft picks the client on the upload screen, not in the file)');
    const seen = new Set();
    const products = rows.map((r, i) => {
      const sku = required(pick(r, 'StockCode', 'Stock Code', 'SKU'), `row ${i + 2} StockCode`);
      if (seen.has(sku.toLowerCase())) throw Error('Duplicate StockCode in file: ' + sku);
      seen.add(sku.toLowerCase());
      const weight = pick(r, 'Weight', 'Weight (KG)', 'WeightKG');
      if (weight !== '' && !Number.isFinite(Number(weight))) throw Error(`row ${i + 2}: Weight is not a number`);
      return { sku, name: required(pick(r, 'Name', 'Description'), `row ${i + 2} Name`), weight: weight === '' ? 0 : Number(weight), barcode: pick(r, 'EAN', 'Barcode', 'UPC') || null, source: r };
    });
    if (dry) return [{ client: clientName, products: products.length, note: 'Product list only. Bin stock, orders and rates are not in this file.' }];
    return tx(db, async () => {
      const clientId = await resolve(db, 'clients', clientName);
      for (const p of products) {
        await db.query(`insert into products (client_id, sku, name, weight_kg, barcode, source_record) values ($1, $2, $3, $4, $5, $6)
          on conflict (client_id, sku) do update set name = excluded.name, weight_kg = excluded.weight_kg, barcode = coalesce(excluded.barcode, products.barcode), source_record = excluded.source_record`,
        [clientId, p.sku, p.name, p.weight, p.barcode, JSON.stringify(p.source)]);
      }
      return [{ imported: products.length, client: clientName, note: 'Set reorder points and mark dangerous goods before the first pick.' }];
    });
  }

  // Orders: the Orders > Overview bulk export. One row per order; items arrive as one "Order Items" field, kept for mapping.
  const orders = rows.map((r, i) => {
    const client = pick(r, 'Client') || f('client');
    const number = pick(r, 'Order Number', 'OrderNumber');
    required(client, `row ${i + 2} Client (or pass --client)`);
    required(number, `row ${i + 2} Order Number`);
    const status = ORDER_STATUS(pick(r, 'Order Status', 'OrderStatus', 'Status'));
    const ordered = exportDate(pick(r, 'Order Date', 'OrderDate')) || (() => { throw Error(`row ${i + 2}: Order Date is required`); })();
    const despatched = exportDate(pick(r, 'Despatch Date', 'DespatchDate'));
    if (status === 'despatched' && !despatched) throw Error(`row ${i + 2}: despatched order ${number} has no Despatch Date`);
    let requiredBy = exportDate(pick(r, 'Required Despatch Date', 'RequiredDespatchDate'));
    if (requiredBy && requiredBy < ordered) requiredBy = ordered;
    const name = pick(r, 'First and Last Name', 'Name') || [pick(r, 'First Name', 'FirstName'), pick(r, 'Last Name', 'LastName')].filter(Boolean).join(' ');
    const address = [pick(r, 'Company Name', 'CompanyName'), pick(r, 'Address 1', 'Address1'), pick(r, 'Address 2', 'Address2'), pick(r, 'Address 3', 'Address3'), pick(r, 'Town'), pick(r, 'County')].filter(Boolean).join(', ');
    const parcels = pick(r, 'Number Of Parcels', 'NumberOfParcels');
    return {
      client, number, status, ordered, despatched: status === 'despatched' ? despatched : null, requiredBy,
      channel: pick(r, 'Channel', 'Source') || 'Mintsoft', name: name || null, email: pick(r, 'Email') || null,
      phone: pick(r, 'Phone', 'Mobile') || null, address: address || null, postcode: pick(r, 'Post Code', 'Postcode', 'PostCode') || null,
      country: (pick(r, 'Country') || 'NZ').toUpperCase().slice(0, 40), service: pick(r, 'Courier Service', 'CourierService') || null,
      tracking: pick(r, 'Tracking Number', 'TrackingNumber') || null, parcels: parcels && Number(parcels) > 0 ? Math.trunc(Number(parcels)) : null, source: r,
    };
  });
  const keys = new Set();
  for (const o of orders) { const k = o.client.toLowerCase() + '\0' + o.number.toLowerCase(); if (keys.has(k)) throw Error('Duplicate order in file: ' + o.number); keys.add(k); }
  if (dry) {
    const by = (s) => orders.filter((o) => o.status === s).length;
    return [{ orders: orders.length, clients: new Set(orders.map((o) => o.client.toLowerCase())).size, despatched: by('despatched'), open: by('open') + by('on_hold'), cancelled: by('cancelled'), note: 'Order headers only. Items stay in source_record until mapped to SKUs.' }];
  }
  return tx(db, async () => {
    let created = 0, updated = 0;
    for (const o of orders) {
      let c = await db.query('select id, despatch_days from clients where lower(name) = lower($1)', [o.client]);
      if (!c.length) c = await db.query('insert into clients (name) values ($1) returning id, despatch_days', [o.client]);
      const requiredBy = o.requiredBy || (await db.query('select ($1::date + $2::integer)::text as d', [o.ordered, c[0].despatch_days]))[0].d;
      let serviceId = null;
      if (o.service) {
        let s = await db.query('select id from courier_services where lower(name) = lower($1)', [o.service]);
        if (!s.length) s = await db.query('insert into courier_services (name, carrier) values ($1, $2) returning id', [o.service, 'From Mintsoft']);
        serviceId = s[0].id;
      }
      const held = o.status === 'on_hold' ? o.ordered : null;
      const res = await db.query(`insert into orders (client_id, number, channel, ordered_on, required_by, status, hold_reason, held_on, recipient_name, recipient_email, recipient_phone, address, postcode, country, courier_service_id, tracking, parcels, despatched_on, source_record)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        on conflict (client_id, number) do update set status = excluded.status, hold_reason = excluded.hold_reason, held_on = excluded.held_on, required_by = excluded.required_by, courier_service_id = excluded.courier_service_id,
          tracking = excluded.tracking, parcels = excluded.parcels, despatched_on = excluded.despatched_on, source_record = excluded.source_record
        returning (xmax = 0) as inserted`,
      [c[0].id, o.number, o.channel, o.ordered, requiredBy, o.status, held ? 'Imported on hold from Mintsoft' : null, held, o.name, o.email, o.phone, o.address, o.postcode, o.country, serviceId, o.tracking, o.parcels, o.despatched, JSON.stringify(o.source)]);
      if (res[0].inserted) created++; else updated++;
    }
    return [{ created, updated, note: 'Open orders need their items mapped to SKUs before picking: see attention.' }];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const args = process.argv.slice(2);
    const out = await run(db, args.filter((x) => x !== '--json'));
    console.log(args.includes('--json') ? JSON.stringify(out, null, 2) : format(out));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
