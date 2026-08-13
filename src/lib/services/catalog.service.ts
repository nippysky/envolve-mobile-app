/**
 * Catalogue service.
 *
 * These endpoints are deliberately unauthenticated on the server, which is what
 * makes public browsing possible without a session. Actions (add to basket,
 * checkout) are gated in the UI and enforced separately by their own routes.
 *
 *   GET /api/catalog/products?search=&category=&sort=&page=&limit=
 *   GET /api/catalog/products/:sku
 *   GET /api/catalog/categories
 */

import { apiFetch } from '@/lib/api-client';

export interface CatalogProduct {
  id:                  number;
  uuid:                string;
  sku:                 string;
  brand_name:          string;
  generic_name:        string | null;
  product_strength:    string | null;
  pack_size:           string | null;
  minimum_order:       number;
  selling_price:       number;
  final_price:         number | null;
  discount_percentage: number | null;
  category:            { id: number; name: string } | null;
  manufacturer:        { id: number; name: string } | null;
  primary_image:       string | null;
  in_stock:            boolean;
  total_stock:         number;
}

export interface ProductImage {
  id:         number;
  url:        string;
  is_primary: boolean;
}

export interface CatalogProductDetail extends Omit<CatalogProduct, 'primary_image'> {
  quantity_per_carton: number | null;
  allow_unit_sale:     boolean;
  images:              ProductImage[];
}

export interface CatalogCategory {
  id:            number;
  name:          string;
  product_count: number;
}

export type CatalogSort = 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

export interface CatalogQuery {
  search?:   string;
  category?: number | null;
  sort?:     CatalogSort;
  page?:     number;
  limit?:    number;
}

interface Paginated<T> {
  records:    T[];
  pagination: { current_page: number; per_page: number; total: number; total_pages: number };
}

export function listProducts(q: CatalogQuery = {}) {
  const p = new URLSearchParams();
  if (q.search)   p.set('search', q.search);
  if (q.category) p.set('category', String(q.category));
  if (q.sort)     p.set('sort', q.sort);
  p.set('page',  String(q.page  ?? 1));
  p.set('limit', String(q.limit ?? 20));

  return apiFetch<Paginated<CatalogProduct>>(`/api/catalog/products?${p.toString()}`);
}

export function getProduct(sku: string) {
  return apiFetch<{ product: CatalogProductDetail }>(
    `/api/catalog/products/${encodeURIComponent(sku)}`,
  );
}

export function listCategories() {
  return apiFetch<{ categories: CatalogCategory[] }>('/api/catalog/categories');
}
