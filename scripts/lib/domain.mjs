// The fields `add` and `set` accept for each record type. Anything else is a migration (/customise).
export const fields = {
  clients: ['name', 'currency', 'order_fee_cents', 'item_fee_cents', 'bin_week_cents', 'return_fee_cents', 'despatch_days', 'personal_data_days'],
  products: ['client_id', 'sku', 'name', 'weight_kg', 'barcode', 'dangerous_goods', 'reorder_point', 'active'],
  bins: ['name', 'zone'],
  courier_services: ['name', 'carrier', 'accepts_dg'],
  asns: ['name', 'client_id', 'expected_on', 'note'],
  charge_runs: ['retain_until'],
};

// The column each record type is found by when you type a name.
export const nameColumn = {
  clients: 'name', products: 'sku', bins: 'name', courier_services: 'name', asns: 'name',
  orders: 'number', returns: 'name', charge_runs: 'name',
};

// Every table, in export order.
export const tables = ['clients', 'products', 'bins', 'stock', 'courier_services', 'asns', 'orders', 'order_lines', 'returns', 'movements', 'charge_runs', 'charge_lines', 'notes'];
