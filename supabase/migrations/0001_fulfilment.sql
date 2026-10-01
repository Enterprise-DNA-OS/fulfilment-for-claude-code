-- Fulfilment for Claude Code: the e-commerce fulfilment schema.
-- Clients (the brands you fulfil for), their SKUs, bin stock, orders and lines,
-- inbound deliveries, returns, the stock movement ledger and client billing runs.
-- Plain Postgres. Runs on any Postgres 13+ and on the embedded PGlite. No extensions.

create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- A client is a brand whose orders you pick, pack and despatch. Rates are in cents.
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  currency text not null default 'NZD' check (currency ~ '^[A-Z]{3}$'),
  order_fee_cents integer check (order_fee_cents >= 0),     -- pick and pack, per despatched order
  item_fee_cents integer check (item_fee_cents >= 0),       -- each item after the first in an order
  bin_week_cents integer check (bin_week_cents >= 0),       -- storage, per occupied bin per week
  return_fee_cents integer check (return_fee_cents >= 0),   -- per processed return
  despatch_days integer not null default 1 check (despatch_days >= 0), -- agreed days from order to despatch
  personal_data_days integer check (personal_data_days > 0),           -- keep recipient details this long after despatch
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_updated before update on clients for each row execute function touch_updated();

create table products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients,
  sku text not null,
  name text not null,
  weight_kg numeric(10,3) not null default 0 check (weight_kg >= 0),
  barcode text,
  dangerous_goods boolean not null default false,
  reorder_point integer not null default 0 check (reorder_point >= 0),
  active boolean not null default true,
  source_record jsonb,
  unique (client_id, sku),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_updated before update on products for each row execute function touch_updated();

create table bins (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  zone text not null default 'Pick face',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bins_updated before update on bins for each row execute function touch_updated();

create table stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products,
  bin_id uuid not null references bins,
  quantity integer not null check (quantity >= 0),
  unique (product_id, bin_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger stock_updated before update on stock for each row execute function touch_updated();

create table courier_services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  carrier text not null,
  accepts_dg boolean not null default false,  -- the carrier has agreed to take dangerous goods on this service
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger courier_services_updated before update on courier_services for each row execute function touch_updated();

-- Advance shipping notices: stock a client says is on its way to you.
create table asns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  client_id uuid not null references clients,
  expected_on date not null,
  received_on date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger asns_updated before update on asns for each row execute function touch_updated();

create table orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients,
  number text not null,
  channel text not null default 'Manual',
  ordered_on date not null default current_date,
  required_by date not null,
  status text not null default 'open' check (status in ('open','on_hold','picked','despatched','cancelled')),
  hold_reason text,
  held_on date,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  address text,
  postcode text,
  country text not null default 'NZ',
  courier_service_id uuid references courier_services,
  tracking text,
  parcels integer check (parcels > 0),
  picked_on date,
  despatched_on date,
  redacted_on date,
  source_record jsonb,
  unique (client_id, number),
  check ((status = 'despatched') = (despatched_on is not null)),
  check ((status = 'on_hold') = (held_on is not null)),
  check (required_by >= ordered_on),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orders_updated before update on orders for each row execute function touch_updated();

create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders,
  product_id uuid not null references products,
  quantity integer not null check (quantity > 0),
  unique (order_id, product_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger order_lines_updated before update on order_lines for each row execute function touch_updated();

create table returns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  order_id uuid not null references orders,
  product_id uuid not null references products,
  quantity integer not null check (quantity > 0),
  reason text not null,
  received_on date not null default current_date,
  outcome text not null default 'pending' check (outcome in ('pending','restocked','written_off')),
  processed_on date,
  check ((outcome = 'pending') = (processed_on is null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger returns_updated before update on returns for each row execute function touch_updated();

-- The stock ledger. Every change to a bin quantity writes one row here in the same transaction.
create table movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products,
  bin_id uuid references bins,
  order_id uuid references orders,
  return_id uuid references returns,
  asn_id uuid references asns,
  kind text not null check (kind in ('receipt','pick','unpick','return','adjustment')),
  quantity integer not null check (quantity <> 0),
  occurred_on date not null default current_date,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger movements_updated before update on movements for each row execute function touch_updated();

create table charge_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  period_from date not null,
  period_to date not null,
  status text not null default 'draft' check (status in ('draft','approved')),
  approved_by text,
  retain_until date not null,
  check (period_to >= period_from),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger charge_runs_updated before update on charge_runs for each row execute function touch_updated();

create table charge_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references charge_runs,
  client_id uuid not null references clients,
  currency text not null,
  kind text not null check (kind in ('orders','extra_items','storage','returns')),
  units integer not null,
  rate_cents integer not null,
  amount_cents integer not null,
  unique (run_id, client_id, kind),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger charge_lines_updated before update on charge_lines for each row execute function touch_updated();

create table notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients,
  note text not null,
  recorded_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger notes_updated before update on notes for each row execute function touch_updated();

-- ------------------------------------------------------------------ views

-- One row per SKU: what is on the shelf, what open orders want, what is free to sell.
create view product_stock_view as
select p.id, c.id as client_id, c.name as client, p.sku, p.name as product, p.dangerous_goods, p.reorder_point, p.active,
  coalesce((select sum(s.quantity) from stock s where s.product_id = p.id), 0)::integer as on_hand,
  coalesce((select sum(l.quantity) from order_lines l join orders o on o.id = l.order_id where l.product_id = p.id and o.status in ('open','on_hold')), 0)::integer as allocated,
  (coalesce((select sum(s.quantity) from stock s where s.product_id = p.id), 0)
   - coalesce((select sum(l.quantity) from order_lines l join orders o on o.id = l.order_id where l.product_id = p.id and o.status in ('open','on_hold')), 0))::integer as available,
  (select count(*) from stock s where s.product_id = p.id and s.quantity > 0)::integer as bins
from products p join clients c on c.id = p.client_id;

create view bin_stock_view as
select s.id, b.name as bin, b.zone, c.name as client, p.sku, p.name as product, s.quantity
from stock s join bins b on b.id = s.bin_id join products p on p.id = s.product_id join clients c on c.id = p.client_id;

create view order_view as
select o.id, c.id as client_id, c.name as client, o.number, o.channel, o.ordered_on, o.required_by, o.status,
  (select count(*) from order_lines l where l.order_id = o.id)::integer as lines,
  coalesce((select sum(l.quantity) from order_lines l where l.order_id = o.id), 0)::integer as items,
  exists (select 1 from order_lines l join products p on p.id = l.product_id where l.order_id = o.id and p.dangerous_goods) as has_dg,
  cs.name as courier_service, o.tracking, o.parcels, o.despatched_on,
  case
    when o.status in ('open','on_hold','picked') and o.required_by < current_date then 'Late'
    when o.status = 'despatched' and o.despatched_on > o.required_by then 'Despatched late'
    when o.status = 'despatched' then 'On time'
    else ''
  end as sla,
  case
    when o.status = 'on_hold' then 'On hold: ' || coalesce(o.hold_reason, 'no reason')
    when o.status <> 'open' then ''
    when not exists (select 1 from order_lines l where l.order_id = o.id) then 'No lines'
    when exists (select 1 from order_lines l join product_stock_view s on s.id = l.product_id where l.order_id = o.id and s.on_hand < l.quantity) then 'Short stock'
    when exists (select 1 from order_lines l join products p on p.id = l.product_id where l.order_id = o.id and not p.active) then 'Inactive SKU'
    else 'Ready to pick'
  end as pick_check
from orders o join clients c on c.id = o.client_id left join courier_services cs on cs.id = o.courier_service_id;

-- Despatch performance against each client's agreed despatch days, last 28 days.
create view sla_view as
select c.id as client_id, c.name as client, c.despatch_days,
  count(o.id) filter (where o.status = 'despatched' and o.despatched_on >= current_date - 27)::integer as despatched_28d,
  count(o.id) filter (where o.status = 'despatched' and o.despatched_on >= current_date - 27 and o.despatched_on <= o.required_by)::integer as on_time_28d,
  count(o.id) filter (where o.status = 'despatched' and o.despatched_on >= current_date - 27 and o.despatched_on > o.required_by)::integer as late_28d,
  case when count(o.id) filter (where o.status = 'despatched' and o.despatched_on >= current_date - 27) = 0 then null
    else round(100.0 * count(o.id) filter (where o.status = 'despatched' and o.despatched_on >= current_date - 27 and o.despatched_on <= o.required_by)
      / count(o.id) filter (where o.status = 'despatched' and o.despatched_on >= current_date - 27))::integer end as on_time_pct,
  count(o.id) filter (where o.status in ('open','on_hold','picked') and o.required_by < current_date)::integer as late_now
from clients c left join orders o on o.client_id = c.id
group by c.id;

-- Storage this week: bins holding each client's stock, at the client's agreed weekly bin rate.
create view storage_view as
select c.id as client_id, c.name as client, c.currency,
  (select count(distinct s.bin_id) from stock s join products p on p.id = s.product_id where p.client_id = c.id and s.quantity > 0)::integer as bins,
  c.bin_week_cents,
  ((select count(distinct s.bin_id) from stock s join products p on p.id = s.product_id where p.client_id = c.id and s.quantity > 0) * coalesce(c.bin_week_cents, 0))::integer as amount_cents
from clients c;

create view attention_view as
select 'Late order' as issue, number as reference, client, 'Due ' || required_by::text || ', ' || status as detail from order_view where sla = 'Late'
union all select 'Short stock blocks order', number, client, 'Due ' || required_by::text from order_view where pick_check = 'Short stock'
union all select 'On hold over 2 days', o.number, c.name, coalesce(o.hold_reason, '') || ' since ' || o.held_on::text from orders o join clients c on c.id = o.client_id where o.status = 'on_hold' and o.held_on < current_date - 2
union all select 'Open order without lines', number, client, 'Map its items before picking' from order_view where status = 'open' and lines = 0
union all select 'Oversold SKU', sku, client, available::text || ' available' from product_stock_view where available < 0
union all select 'Below reorder point', sku, client, available::text || ' available, reorder at ' || reorder_point::text from product_stock_view where reorder_point > 0 and available between 0 and reorder_point
union all select 'Inbound overdue', a.name, c.name, 'Expected ' || a.expected_on::text from asns a join clients c on c.id = a.client_id where a.received_on is null and a.expected_on < current_date
union all select 'Return waiting over 5 days', r.name, c.name, r.reason || ', received ' || r.received_on::text from returns r join orders o on o.id = r.order_id join clients c on c.id = o.client_id where r.outcome = 'pending' and r.received_on < current_date - 5
union all select 'Missing client rate', name, name, 'Order, item, storage or return rate not agreed' from clients where order_fee_cents is null or item_fee_cents is null or bin_week_cents is null or return_fee_cents is null;

-- Orders whose recipient details have passed the client's retention period.
create view privacy_due_view as
select o.id, c.name as client, o.number, o.despatched_on, c.personal_data_days,
  (o.despatched_on + c.personal_data_days) as keep_until
from orders o join clients c on c.id = o.client_id
where o.status in ('despatched','cancelled') and o.redacted_on is null and c.personal_data_days is not null
  and coalesce(o.despatched_on, o.ordered_on) + c.personal_data_days < current_date
  and not exists (select 1 from returns r where r.order_id = o.id and r.outcome = 'pending');

create view compliance_view as
select 'NZ-IPP9 / AU-APP11.2' as rule, number as reference, client, 'Recipient details kept past ' || keep_until::text as finding from privacy_due_view
union all select 'NZ-IPP9 / AU-APP11.2', name, name, 'No retention period set for recipient details' from clients where personal_data_days is null
union all select 'NZ-IRD-7Y / AU-ATO-5Y', name, 'Billing', 'Charge run kept only until ' || retain_until::text || ', under seven years after ' || period_to::text from charge_runs where retain_until < (period_to + interval '7 years')::date
union all select 'POLICY-DG', o.number, c.name, 'Dangerous goods despatched on ' || coalesce(cs.name, 'no service') || ', which is not marked as accepting them'
  from orders o join clients c on c.id = o.client_id left join courier_services cs on cs.id = o.courier_service_id
  where o.status = 'despatched' and coalesce(cs.accepts_dg, false) = false
    and exists (select 1 from order_lines l join products p on p.id = l.product_id where l.order_id = o.id and p.dangerous_goods);
