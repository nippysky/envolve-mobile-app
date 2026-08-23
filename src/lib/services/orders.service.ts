/**
 * Orders, payment and tracking.
 *
 * Every shape here was read off the web route handlers rather than assumed —
 * where a field name looks odd (`preview_items`, `records`) it's because that's
 * what the API actually returns.
 *
 *   GET  /api/orders/my?page=&limit=      → paginated order summaries
 *   GET  /api/orders/:id                  → full order incl. items + delivery
 *   POST /api/orders                      → place an order
 *   POST /api/payments/initiate           → Paystack authorization URL
 *   GET  /api/payments/verify/:reference  → confirm and settle
 *   GET  /api/track/:code                 → public tracking (no auth)
 *
 * Payment note: `POST /api/orders` with payment_method 'paystack' re-verifies
 * the reference server-side before it will touch inventory. So the client flow
 * is initiate → pay in browser → verify → create order, and a customer who
 * abandons the browser sheet never creates a half-formed order.
 */

import { apiFetch } from '@/lib/api-client';

/* ── Shared ─────────────────────────────────────────────────────────────── */

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED' | 'FAILED';

/** Mirrors the Prisma `DeliveryStatus` enum exactly — do not invent members. */
export type DeliveryStatus =
  | 'AWAITING_DISPATCH' | 'ASSIGNED' | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'  | 'DELIVERED' | 'FAILED' | 'RETURNED';

interface Paginated<T> {
  records:    T[];
  pagination: { current_page: number; per_page: number; total: number; total_pages: number };
}

/* ── Order list ─────────────────────────────────────────────────────────── */

export interface OrderPreviewItem {
  brand_name:    string;
  sku:           string;
  quantity:      number;
  unit_price:    number;
  primary_image: string | null;
}

export interface OrderSummary {
  id:              number;
  order_number:    string;
  status:          OrderStatus;
  payment_status:  PaymentStatus;
  subtotal:        number;
  delivery_fee:    number;
  total:           number;
  created_at:      string;
  /** Capped at 3 by the API — never the full basket. */
  preview_items:   OrderPreviewItem[];
  delivery_status: DeliveryStatus | null;
  tracking_code:   string | null;
}

/**
 * `status` accepts any OrderStatus, or `active` for "not finished yet".
 *
 * Filtering server-side rather than over the loaded pages: with infinite
 * scroll, a client-side filter only ever sees what has already been fetched,
 * so picking "Cancelled" showed the cancelled orders *among the first ten*
 * rather than all of them.
 */
export function listMyOrders(
  page = 1,
  limit = 10,
  status?: string,
) {
  const p = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) p.set('status', status);
  return apiFetch<Paginated<OrderSummary>>(`/api/orders/my?${p.toString()}`);
}

/* ── Order detail ───────────────────────────────────────────────────────── */

export interface OrderItem {
  id:         number;
  quantity:   number;
  unit_price: number;
  subtotal:   number;
  product: {
    sku:              string;
    brand_name:       string;
    generic_name:     string | null;
    product_strength: string | null;
    pack_size:        string | null;
    shelf_location:   string | null;
    manufacturer:     string | null;
    primary_image:    string | null;
    batch_number:     string | null;
    expiry_date:      string | null;
  };
}

export interface OrderDetail {
  id:                number;
  uuid:              string;
  order_number:      string;
  /** Set when a staff member or admin placed this order for the customer. */
  placed_by:         { id: number; name: string; role: string } | null;
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
  };
  items: OrderItem[];
  delivery: {
    id:            number;
    uuid:          string;
    tracking_code: string;
    status:        DeliveryStatus;
    dispatched_at: string | null;
    delivered_at:  string | null;
    notes:         string | null;
    driver:        { id: number; name: string; phone: string | null } | null;
  } | null;
}

export function getOrder(id: number | string) {
  return apiFetch<{ order: OrderDetail }>(`/api/orders/${id}`);
}

/* ── Placing an order ───────────────────────────────────────────────────── */

export type PaymentMethod = 'paystack' | 'bank_transfer' | 'cash_on_delivery';

export interface PlaceOrderInput {
  items:              { product_id: number; quantity: number }[];
  state:              string;
  city:               string;
  /** The API enforces a minimum of 8 characters. */
  street_address:     string;
  contact_phone:      string;
  delivery_notes?:    string;
  po_number?:         string;
  payment_method:     PaymentMethod;
  /** Required when payment_method is 'paystack'. */
  paystack_reference?: string;
  /**
   * Naira of referral credit to apply. The server re-checks the live balance,
   * the redemption toggle and the subtotal, and applies whatever survives — so
   * this is a request, not a guarantee.
   */
  referral_credit?:   number;
}

export function placeOrder(input: PlaceOrderInput) {
  return apiFetch<{ order_number: string; order_id: number; total: number }>(
    '/api/orders',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

/* ── Payment ────────────────────────────────────────────────────────────── */

export function initiatePayment(input: {
  amount: number;
  order_id?: number;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}) {
  return apiFetch<{ reference: string; authorization_url: string; access_code: string }>(
    '/api/payments/initiate',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function verifyPayment(reference: string) {
  return apiFetch<{
    verified:  boolean;
    reference: string;
    amount:    number | null;
    message:   string;
  }>(`/api/payments/verify/${encodeURIComponent(reference)}`);
}

/* ── Tracking ───────────────────────────────────────────────────────────── */

export interface TrackingResult {
  tracking_code:   string | null;
  delivery_status: DeliveryStatus | null;
  order_number:    string | null;
  order_status:    OrderStatus | null;
  delivery_city:   string | null;
  delivery_state:  string | null;
  dispatched_at:   string | null;
  delivered_at:    string | null;
  order_placed_at: string | null;
}

/** Accepts a delivery tracking code *or* an order number. Requires no session. */
export function track(code: string) {
  return apiFetch<TrackingResult>(`/api/track/${encodeURIComponent(code.trim())}`);
}
