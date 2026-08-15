/**
 * Admin & staff console service layer.
 *
 * Every shape here was read off the web route handlers rather than assumed.
 * Two conventions worth internalising before editing anything below:
 *
 *   • Paginated routes return `records`, never `items`. Reading `data.items`
 *     yields `undefined` and renders an empty list with no error — it's the
 *     most common way to break an integration against this API.
 *   • `/api/staff` serves STAFF **and** DRIVER users from one endpoint. The
 *     `role` field distinguishes them, and drivers carry `driver_record_id`,
 *     which is the *driver table* primary key — not `id`, which is the user
 *     id. Delivery assignment needs `driver_record_id`.
 *
 * Role gates, taken from the route handlers:
 *   ADMIN only        → staff CRUD, settings, audit logs, product writes,
 *                       assign-staff, quick-import
 *   ADMIN or STAFF    → orders, customers, inventory, reports, search
 *   + DRIVER          → deliveries
 */

import { apiFetch } from '@/lib/api-client';
import type {
  OrderStatus, PaymentStatus, DeliveryStatus,
} from './orders.service';

export type { OrderStatus, PaymentStatus, DeliveryStatus };

interface Paginated<T> {
  records:    T[];
  pagination: { current_page: number; per_page: number; total: number; total_pages: number };
}

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  return p.toString();
}

/* ══ Reports ═══════════════════════════════════════════════════════════════ */

export interface ReportSummary {
  scope:  'platform' | 'staff';
  period: number;
  kpis: {
    revenue:            number;
    revenueTrend:       number | null;
    orders:             number;
    ordersTrend:        number | null;
    avgOrderValue:      number;
    activeShipments:    number;
    newCustomers:       number;
    newCustomersTrend:  number | null;
    totalCustomers:     number;
  };
  revenueByDay:      { date: string; revenue: number }[];
  ordersByStatus:    { status: OrderStatus; count: number }[];
  topCustomers:      { id: number; name: string; company: string | null; revenue: number; orders: number }[];
  topProducts:       { id: number; name: string; sku: string; revenue: number; units: number }[];
  revenueByCategory: { category: string; revenue: number }[];
  deliveryMetrics:   { byStatus: { status: DeliveryStatus; count: number }[] };
}

/** `period` is a day count. The API clamps it; 7/30/90 are the useful values. */
export function getReportSummary(period = 30, staffId?: number) {
  return apiFetch<ReportSummary>(`/api/reports/summary?${qs({ period, staff_id: staffId })}`);
}

/* ══ Orders ════════════════════════════════════════════════════════════════ */

export interface AdminOrder {
  id:                number;
  uuid:              string;
  order_number:      string;
  status:            OrderStatus;
  payment_status:    PaymentStatus;
  payment_reference: string | null;
  delivery_address:  string | null;
  delivery_city:     string | null;
  delivery_state:    string | null;
  subtotal:          number;
  discount:          number;
  delivery_fee:      number;
  total:             number;
  notes:             string | null;
  created_at:        string;
  updated_at:        string;
  customer: {
    id: number; company_name: string | null;
    first_name: string; last_name: string;
    email: string; phone: string | null;
  } | null;
  item_count: number;
  delivery: {
    status: DeliveryStatus;
    tracking_code: string;
    driver_id: number | null;
  } | null;
}

export function listOrders(opts: {
  page?: number; limit?: number; search?: string;
  status?: OrderStatus | null; payment_status?: PaymentStatus | null;
} = {}) {
  return apiFetch<Paginated<AdminOrder>>(`/api/orders?${qs({
    page: opts.page ?? 1, limit: opts.limit ?? 20,
    search: opts.search, status: opts.status, payment_status: opts.payment_status })}`);
}

export function updateOrderStatus(id: number, status: OrderStatus, notes?: string) {
  return apiFetch<{ id: number; status: OrderStatus }>(`/api/orders/${id}/status`, {
    method: 'PATCH',
    body:   JSON.stringify({ status, notes }),
  });
}

/* ── On-behalf ordering ─────────────────────────────────────────────────── */

export type OnBehalfPaymentMethod =
  | 'payment_link' | 'bank_transfer' | 'cash_on_delivery' | 'payment_received';

export interface OnBehalfOrderInput {
  customer_id:    number;
  items:          { product_id: number; quantity: number }[];
  state:          string;
  city:           string;
  street_address: string;
  contact_phone:  string;
  delivery_notes?: string;
  po_number?:      string;
  payment_method:  OnBehalfPaymentMethod;
  /** Required when payment_method is 'payment_received'. */
  received_via?:      'cash' | 'bank_transfer' | 'pos' | 'other';
  /** Required when payment_method is 'payment_received' — teller/POS/transfer ref. */
  payment_reference?: string;
  payment_note?:      string;
}

export function createOrderOnBehalf(input: OnBehalfOrderInput) {
  return apiFetch<{ order_number: string; order_id: number; total: number }>(
    '/api/orders/on-behalf',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

/**
 * Manually settle an on-behalf order.
 *
 * Returns 403 for orders the customer placed themselves — those are settled by
 * the Paystack webhook and must never be set by hand. The console should only
 * offer this action on orders with a `placed_by`.
 */
export function confirmOrderPayment(id: number, input: {
  received_via: 'cash' | 'bank_transfer' | 'pos' | 'other';
  payment_reference: string;
  payment_note?: string;
}) {
  return apiFetch<{ id: number; payment_status: PaymentStatus }>(
    `/api/orders/${id}/confirm-payment`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

/* ══ Customers ═════════════════════════════════════════════════════════════ */

/**
 * Mirrors the Prisma `CustomerStatus` enum exactly. There is no PENDING or
 * SUSPENDED — onboarding runs REGISTERED → OTP_CONFIRMED → PCN_CERT_UPLOADED →
 * PENDING_REVIEW, and a staff decision moves it to APPROVED or REJECTED.
 *
 * The API validates the `status` query param against this list and *ignores*
 * anything else rather than erroring, so an invented value silently returns
 * unfiltered results.
 */
export type CustomerStatus =
  | 'REGISTERED' | 'OTP_CONFIRMED' | 'PCN_CERT_UPLOADED'
  | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

/** The one status that means "a human needs to look at this". */
export const AWAITING_REVIEW: CustomerStatus = 'PENDING_REVIEW';

export interface AdminCustomer {
  id:                  number;
  uuid:                string;
  company_name:        string | null;
  address:             string | null;
  city:                string | null;
  state:               string | null;
  pcn_certificate_url: string | null;
  pcn_verified:        boolean;
  status:              CustomerStatus;
  referral_code:       string | null;
  referred_by:         string | null;
  review_note:         string | null;
  reviewed_at:         string | null;
  created_at:          string;
  updated_at:          string;
  user: {
    id: number; first_name: string; last_name: string;
    email: string; phone: string | null;
    status: string; avatar_url: string | null; created_at: string;
  };
  reviewed_by:    string | null;
  assigned_staff: { id: number; first_name: string; last_name: string; email: string } | null;
}

export function listCustomers(opts: {
  page?: number; limit?: number; search?: string;
  status?: CustomerStatus | null; assigned_staff_id?: number | null;
} = {}) {
  return apiFetch<Paginated<AdminCustomer>>(`/api/customers?${qs({
    page: opts.page ?? 1, limit: opts.limit ?? 20,
    search: opts.search, status: opts.status,
    assigned_staff_id: opts.assigned_staff_id })}`);
}

/**
 * Single customer.
 *
 * Two things differ from the list endpoint and have caught us out already:
 *
 *   1. The detail route returns the customer **directly** as `data`, not
 *      wrapped in `{ customer }` the way most single-entity routes here do.
 *   2. `reviewed_by` is an **object** here but a plain string in the list.
 *
 * Hence a separate type rather than reusing `AdminCustomer`. Typing this as
 * `{ customer: … }` silently yields `undefined` and renders an error screen on
 * a customer that loads fine on the web — which is exactly what happened.
 */
export interface AdminCustomerDetail extends Omit<AdminCustomer, 'reviewed_by'> {
  reviewed_by: { id: number; name: string; email: string } | null;
  /** Only the detail route returns this. */
  order_count: number;
}

export function getCustomer(id: number) {
  return apiFetch<AdminCustomerDetail>(`/api/customers/${id}`);
}

/** Approve or reject a pending pharmacy account. */
export function reviewCustomer(id: number, input: {
  status: 'APPROVED' | 'REJECTED';
  review_note?: string;
}) {
  return apiFetch<{ id: number; status: CustomerStatus }>(`/api/customers/${id}/review`, {
    method: 'PATCH',
    body:   JSON.stringify(input),
  });
}

/**
 * Assign a sales rep. ADMIN only.
 *
 * The body key is `staff_user_id` — the *user* id, not a staff-table id. Pass
 * null to unassign.
 */
export function assignStaff(customerId: number, staffUserId: number | null) {
  return apiFetch<{ id: number }>(`/api/customers/${customerId}/assign-staff`, {
    method: 'PATCH',
    body:   JSON.stringify({ staff_user_id: staffUserId }),
  });
}

export interface PcnCertificate {
  /** The original file, exactly as stored. Empty string when unavailable. */
  url:         string;
  /**
   * A server-signed JPEG of page one, safe to render as an image even for
   * PDFs. Falls back to `url` when the API is older and doesn't send it.
   */
  preview_url: string;
  is_pdf:      boolean;
}

/** Cloudinary serves PDFs under `/raw/` or with a `.pdf` suffix, depending on
 *  how the upload was detected. Both mean "don't try to render this as an
 *  image". */
function looksLikePdf(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('.pdf') || u.includes('/raw/');
}

/**
 * Deliverable URL for a customer's PCN certificate.
 *
 * ## Why there are two URLs
 *
 * Cloudinary **blocks PDF delivery by default**, so the original URL 401s for
 * PDF certificates — which a browser draws as a broken-image icon. The server
 * therefore also returns `preview_url`: a signed transformation that rasterises
 * page one to JPEG. Image delivery isn't restricted, so the preview renders
 * whatever the original is.
 *
 * **Never rewrite either URL.** Both are signed and the signature covers the
 * transformation string, so appending anything client-side invalidates them.
 * That's precisely why the preview is built server-side.
 *
 * ## Three response shapes
 *
 * Current: `{ url, preview_url, is_pdf }`. Before that: `{ url, is_pdf }`.
 * Before that: a bare `{ signedUrl }` with no `data` wrapper — a
 * token-authenticated URL that 401'd, because token auth isn't enabled here.
 *
 * This reads whichever it gets. That isn't defensive padding: a mobile build
 * outlives any single API deploy, so a client that only understands the newest
 * shape breaks for every user until they update.
 *
 * `url` is normalised to `''` rather than `undefined` when neither is present,
 * so callers can test truthiness instead of guessing — passing `undefined` to
 * an image source renders a broken frame, and passing it to the browser throws.
 *
 * Calling this is what writes the "who viewed this licence" audit entry, so
 * never bypass it by using `pcn_certificate_url` from the customer record.
 */
export async function getPcnUrl(customerId: number): Promise<PcnCertificate> {
  const res = await apiFetch<{
    url?: string; preview_url?: string; is_pdf?: boolean; signedUrl?: string;
  }>(`/api/customers/${customerId}/pcn-url`);

  const url = (res.url ?? res.signedUrl ?? '').trim();

  return {
    url,
    // An older API sends no preview. Falling back to the original keeps the
    // screen working — it just can't render a PDF inline.
    preview_url: (res.preview_url ?? '').trim() || url,
    // Trust the server when it tells us, derive it when it doesn't.
    is_pdf: res.is_pdf ?? (url ? looksLikePdf(url) : false),
  };
}


/* ══ Products ══════════════════════════════════════════════════════════════ */

/** Mirrors the Prisma `ProductStatus` enum. No INACTIVE or ARCHIVED. */
export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'DISCONTINUED';

export interface AdminProduct {
  id:                  number;
  uuid:                string;
  sku:                 string;
  brand_name:          string;
  generic_name:        string | null;
  product_strength:    string | null;
  pack_size:           string | null;
  quantity_per_carton: number | null;
  allow_unit_sale:     boolean;
  minimum_order:       number;
  selling_price:       number;
  last_cost_price:     number | null;
  final_price:         number | null;
  discount_percentage: number | null;
  minimum_stock_level: number;
  reorder_quantity:    number | null;
  shelf_location:      string | null;
  status:              ProductStatus;
  category:            { id: number; name: string } | null;
  manufacturer:        { id: number; name: string } | null;
  primary_image:       string | null;
  images:              { id: number; url: string; is_primary: boolean }[];
  total_stock:         number;
  created_at:          string;
  updated_at:          string;
}

export function listAdminProducts(opts: {
  page?: number; limit?: number; search?: string;
  status?: ProductStatus | null; category?: number | null;
} = {}) {
  return apiFetch<Paginated<AdminProduct>>(`/api/products?${qs({
    page: opts.page ?? 1, limit: opts.limit ?? 20,
    search: opts.search, status: opts.status, category: opts.category })}`);
}

export function getAdminProduct(sku: string) {
  return apiFetch<{ product: AdminProduct }>(`/api/products/${encodeURIComponent(sku)}`);
}

/** ADMIN only — staff have read access to products but cannot write. */
export function updateProduct(sku: string, patch: Partial<{
  brand_name: string; generic_name: string; product_strength: string;
  pack_size: string; minimum_order: number; selling_price: number;
  minimum_stock_level: number; reorder_quantity: number;
  shelf_location: string; status: ProductStatus;
  category_id: number; manufacturer_id: number;
}>) {
  return apiFetch<{ product: AdminProduct }>(`/api/products/${encodeURIComponent(sku)}`, {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  });
}

export function listCategories() {
  return apiFetch<{ categories: { id: number; name: string; product_count?: number }[] }>(
    '/api/products/categories',
  );
}

export function listManufacturers() {
  return apiFetch<{ manufacturers: { id: number; name: string }[] }>(
    '/api/products/manufacturers',
  );
}

/* ══ Inventory ═════════════════════════════════════════════════════════════ */

export interface InventoryBatch {
  id:             number;
  batch_number:   string;
  quantity:       number;
  cost_price:     number;
  expiry_date:    string | null;
  received_at:    string;
  is_low_stock:   boolean;
  is_near_expiry: boolean;
  product: {
    id: number; sku: string; brand_name: string;
    generic_name: string | null;
    minimum_stock_level: number;
    primary_image: string | null;
  };
}

export function listInventory(opts: {
  page?: number; limit?: number; search?: string;
  low_stock?: boolean; near_expiry?: boolean;
} = {}) {
  return apiFetch<Paginated<InventoryBatch>>(`/api/inventory?${qs({
    page: opts.page ?? 1, limit: opts.limit ?? 20,
    search: opts.search,
    low_stock:   opts.low_stock   ? 'true' : undefined,
    near_expiry: opts.near_expiry ? 'true' : undefined })}`);
}

export interface InventoryStats {
  total_skus:      number;
  low_stock_count: number;
  expiring_count:  number;
  /** Sum of batch quantities across the whole warehouse, not a value. */
  total_stock:     number;
}

export function getInventoryStats() {
  return apiFetch<InventoryStats>('/api/inventory/stats');
}

/** Positive `quantity` adds stock, negative removes it. `reason` is audited. */
export function adjustStock(input: {
  batch_id: number; quantity: number; reason: string;
}) {
  return apiFetch<{ id: number; quantity: number }>('/api/inventory/adjust', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

export function receiveStock(input: {
  product_id: number; batch_number: string; quantity: number;
  cost_price: number; expiry_date?: string;
}) {
  return apiFetch<{ id: number }>('/api/inventory/receive', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

/* ══ Deliveries ════════════════════════════════════════════════════════════ */

export interface AdminDelivery {
  id:            number;
  uuid:          string;
  tracking_code: string;
  status:        DeliveryStatus;
  dispatched_at: string | null;
  delivered_at:  string | null;
  notes:         string | null;
  created_at:    string;
  updated_at:    string;
  order: {
    id:               number;
    order_number:     string;
    order_status:     OrderStatus;
    payment_status:   PaymentStatus;
    delivery_address: string | null;
    delivery_city:    string | null;
    delivery_state:   string | null;
    total:            number;
    customer: {
      company_name: string | null;
      first_name: string; last_name: string;
      email: string; phone: string | null;
    } | null;
  } | null;
  /** `id` here is the driver-table id, which is what assignment expects. */
  driver: { id: number; first_name: string; last_name: string; phone: string | null } | null;
}

export function listDeliveries(opts: {
  page?: number; limit?: number; search?: string;
  status?: DeliveryStatus | null;
} = {}) {
  return apiFetch<Paginated<AdminDelivery>>(`/api/deliveries?${qs({
    page: opts.page ?? 1, limit: opts.limit ?? 20,
    search: opts.search, status: opts.status })}`);
}

/**
 * Update a delivery.
 *
 * `cash_collected` is deliberately a separate flag rather than something
 * inferred from `status: 'DELIVERED'` — a driver who hands over without
 * collecting must not silently leave the books showing paid.
 *
 * `driver_id` is the driver-table id (`driver_record_id` on a staff record).
 */
export function updateDelivery(id: number, input: {
  status?: DeliveryStatus;
  driver_id?: number | null;
  notes?: string;
  cash_collected?: boolean;
}) {
  return apiFetch<{ id: number; status: DeliveryStatus }>(`/api/deliveries/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(input),
  });
}

/* ══ Staff & drivers ═══════════════════════════════════════════════════════ */

export type StaffRole = 'ADMIN' | 'STAFF' | 'DRIVER';

export interface StaffMember {
  id:                  number;
  uuid:                string;
  first_name:          string;
  last_name:           string;
  email:               string;
  phone:               string | null;
  role:                StaffRole;
  status:              string;
  avatar_url:          string | null;
  created_at:          string;
  employee_code:       string | null;
  department:          string | null;
  job_title:           string | null;
  verification_status: string | null;
  driver_status:       string | null;
  vehicle_plate:       string | null;
  vehicle_type:        string | null;
  /**
   * Driver-table primary key. Distinct from `id`, which is the user id.
   * Delivery assignment takes this, not `id`.
   */
  driver_record_id:    number | null;
  /** Customer accounts this person owns as sales rep. */
  assigned_customers:  number;
}

export function listStaff(opts: {
  page?: number; limit?: number; search?: string;
  role?: StaffRole | null; status?: string | null;
} = {}) {
  return apiFetch<Paginated<StaffMember>>(`/api/staff?${qs({
    page: opts.page ?? 1, limit: opts.limit ?? 100,
    search: opts.search, role: opts.role, status: opts.status })}`);
}

export function createStaff(input: {
  first_name: string; last_name: string; email: string;
  middle_name?: string; phone?: string; gender?: string;
  department?: string; job_title?: string;
  role?: 'STAFF' | 'DRIVER';
  vehicle_plate?: string; vehicle_type?: string; region?: string;
}) {
  return apiFetch<{ id: number; email: string }>('/api/staff', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

export function updateStaff(id: number, patch: Partial<{
  first_name: string; last_name: string; phone: string;
  department: string; job_title: string; status: string;
  vehicle_plate: string; vehicle_type: string; region: string;
}>) {
  return apiFetch<{ id: number }>(`/api/staff/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  });
}

export function resendStaffInvite(id: number) {
  return apiFetch<{ sent: boolean }>(`/api/staff/${id}/resend-invite`, { method: 'POST' });
}

/* ══ Settings ══════════════════════════════════════════════════════════════ */

/**
 * Settings are stored as strings in `app_settings` and returned as strings.
 * Booleans arrive as `'true'` / `'false'`; parse at the edge, don't trust
 * truthiness — the string `'false'` is truthy.
 */
export interface AppSettings {
  company_name?:        string;
  company_email?:       string;
  company_phone?:       string;
  hq_address?:          string;
  currency?:            string;
  timezone?:            string;
  email_audit_summary?: string;
  auto_logout?:         string;
  vat_enabled?:         string;
  vat_rate?:            string;
  /** All referral values are naira — they feed one wallet. */
  referral_signup_bonus?:       string;
  referral_threshold?:          string;
  referral_reward?:             string;
  /** 'true' lets customers spend their balance at checkout. Off by default. */
  referral_redemption_enabled?: string;
  referral_min_redemption?:     string;
  staff_order_scope?:           string;
}

/** Returns the settings map directly as `data` — not wrapped in `{ settings }`. */
export function getSettings() {
  return apiFetch<AppSettings>('/api/admin/settings');
}

/**
 * Keys outside the server's allow-list are silently dropped, so the response
 * echoes back the keys it actually wrote. Compare against what you sent rather
 * than assuming a 200 means everything landed.
 */
export function updateSettings(patch: AppSettings) {
  return apiFetch<{ updated: string[] }>('/api/admin/settings', {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  });
}

/* ══ Audit ═════════════════════════════════════════════════════════════════ */

export interface AuditLogEntry {
  id:          number;
  user_id:     number | null;
  user_type:   string | null;
  user_name:   string | null;
  email:       string | null;
  action:      string;
  entity_type: string | null;
  entity_id:   string | null;
  description: string | null;
  ip_address:  string | null;
  user_agent:  string | null;
  created_at:  string;
}

export function listAuditLogs(opts: {
  page?: number; limit?: number; search?: string;
  action?: string | null; user_type?: string | null;
  entity_type?: string | null; from?: string | null; to?: string | null;
} = {}) {
  return apiFetch<Paginated<AuditLogEntry>>(`/api/admin/audit-logs?${qs({
    page: opts.page ?? 1, limit: opts.limit ?? 25,
    search: opts.search, action: opts.action, user_type: opts.user_type,
    entity_type: opts.entity_type, from: opts.from, to: opts.to })}`);
}

/* ══ Search ════════════════════════════════════════════════════════════════ */

export interface SearchResults {
  products: {
    id: number; sku: string; brand_name: string;
    generic_name: string | null; status: ProductStatus;
    primary_image: string | null;
  }[];
  customers: {
    id: number; company_name: string | null; name: string;
    email: string; status: CustomerStatus;
  }[];
  orders: {
    id: number; order_number: string; status: OrderStatus;
    total: number; customer_name: string;
  }[];
}

/** Server-side cached for 10s and capped per entity type — not paginated. */
export function globalSearch(query: string) {
  return apiFetch<SearchResults>(`/api/search?${qs({ q: query })}`);
}
