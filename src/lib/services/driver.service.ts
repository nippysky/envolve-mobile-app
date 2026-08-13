/**
 * Driver service.
 *
 * Thin, because `/api/deliveries` already does the hard part: it scopes every
 * response to the signed-in driver's own runs. There is no `driver_id` filter
 * to pass and no way for a driver to see someone else's work — the server
 * resolves their driver record from the session.
 *
 * The status transitions a driver may make are enforced server-side too:
 *
 *   ASSIGNED         → IN_TRANSIT
 *   IN_TRANSIT       → OUT_FOR_DELIVERY | FAILED
 *   OUT_FOR_DELIVERY → DELIVERED | FAILED
 *
 * `DRIVER_NEXT` below mirrors that table exactly. It exists so the UI offers
 * only legal moves rather than showing a button that returns 422 — but the
 * server remains the authority, and this must be kept in step with it.
 */

import { apiFetch } from '@/lib/api-client';
import type { DeliveryStatus, AdminDelivery } from './admin.service';

export type { DeliveryStatus };
/** Same payload shape the console sees — one endpoint, one contract. */
export type DriverDelivery = AdminDelivery;

interface Paginated<T> {
  records:    T[];
  pagination: { current_page: number; per_page: number; total: number; total_pages: number };
}

/** Mirrors `DRIVER_TRANSITIONS` in the API. Keep in step. */
export const DRIVER_NEXT: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  ASSIGNED:         ['IN_TRANSIT'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
};

/** Statuses that mean the run is over, one way or another. */
export const SETTLED: DeliveryStatus[] = ['DELIVERED', 'FAILED', 'RETURNED'];

export function listMyDeliveries(opts: {
  page?: number; limit?: number; status?: DeliveryStatus | null; search?: string;
} = {}) {
  const p = new URLSearchParams();
  p.set('page',  String(opts.page  ?? 1));
  p.set('limit', String(opts.limit ?? 20));
  if (opts.status) p.set('status', opts.status);
  if (opts.search) p.set('search', opts.search);
  return apiFetch<Paginated<DriverDelivery>>(`/api/deliveries?${p.toString()}`);
}

/**
 * Advance a delivery.
 *
 * `cashCollected` must be sent explicitly alongside `DELIVERED` when money
 * changed hands. The API will not infer it from the status — a handover where
 * nothing was collected must not leave the books showing paid, and only the
 * driver standing there knows which happened.
 */
export function updateMyDelivery(id: number, input: {
  status?: DeliveryStatus;
  notes?: string;
  cash_collected?: boolean;
}) {
  return apiFetch<{ id: number; status: DeliveryStatus }>(`/api/deliveries/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(input),
  });
}
