/**
 * Public Catalogue — accessible without login.
 * Shows all ACTIVE products. Browsing is open; purchasing requires a customer account.
 * GET /api/catalog/products (no auth required)
 */

import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNaira } from '@/lib/format';
import { API_BASE, MOBILE_HEADERS } from '@/constants/api';

interface Product {
  id:               number;
  sku:              string;
  brand_name:       string;
  generic_name:     string | null;
  product_strength: string | null;
  selling_price:    number;
  final_price:      number | null;
  discount_percentage: number | null;
  minimum_order:    number | null;
  category:         { id: number; name: string } | null;
  images:           { url: string }[];
}

interface CatalogResponse {
  records:    Product[];
  pagination: { total: number; current_page: number; total_pages: number };
}

async function fetchCatalog(search: string, page: number): Promise<CatalogResponse> {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.set('search', search);
  const res = await fetch(`${API_BASE}/api/catalog/products?${params}`, {
    headers: MOBILE_HEADERS,
  });
  const json = await res.json();
  // Backend wraps in { status, message, data: { records, pagination } }
  return json.data;
}

export default function PublicCatalogue() {
  const insets = useSafeAreaInsets();
  const [search, setSearch]       = useState('');
  const [debSearch, setDebSearch] = useState('');

  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function handleSearch(t: string) {
    setSearch(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebSearch(t), 400);
  }

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['public-catalog', debSearch],
    queryFn:  () => fetchCatalog(debSearch, 1),
    staleTime: 5 * 60_000,
  });

  const products = data?.records ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Icon name="back" size={18} color={Colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Product Catalogue</Text>
          <Text style={styles.subheading}>Browse our medicines & healthcare products</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={Colors.ink4} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search medicines, brands…"
            placeholderTextColor={Colors.ink4}
            value={search}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => { setSearch(''); setDebSearch(''); }} hitSlop={8}>
              <Icon name="close" size={14} color={Colors.ink4} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Guest banner */}
      <Pressable
        style={styles.guestBanner}
        onPress={() => router.replace('/(auth)/sign-in')}
      >
        <Icon name="lock" size={14} color={Colors.brand} />
        <Text style={styles.guestBannerText}>
          Sign in as a customer to place orders
        </Text>
        <Icon name="chevron-right" size={14} color={Colors.brand} />
      </Pressable>

      {/* Products */}
      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={200} radius={16} style={{ flex: 1, minWidth: '44%' }} />
          ))}
        </View>
      ) : isError ? (
        <EmptyState
          iconName="alert"
          title="Couldn't load catalogue"
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : products.length === 0 ? (
        <EmptyState
          iconName="product"
          title="No products found"
          subtitle={debSearch ? `No results for "${debSearch}"` : 'Products will appear here once available.'}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.sku}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />
          }
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </View>
  );
}

function ProductCard({ product }: { product: Product }) {
  const imageUrl = product.images[0]?.url;
  const price    = product.final_price ?? product.selling_price;
  const hasDiscount = !!product.discount_percentage && product.discount_percentage > 0;

  return (
    <Pressable
      style={({ pressed }) => [card.wrap, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      onPress={() => router.push(`/(public)/catalogue/${product.sku}`)}
    >
      {/* Image */}
      <View style={card.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={card.image} resizeMode="contain" />
        ) : (
          <View style={card.imagePlaceholder}>
            <Icon name="product" size={28} color={Colors.ink4} />
          </View>
        )}
        {hasDiscount && (
          <View style={card.discountBadge}>
            <Text style={card.discountText}>-{Math.round(product.discount_percentage!)}%</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={card.info}>
        {product.category && (
          <Text style={card.category} numberOfLines={1}>{product.category.name}</Text>
        )}
        <Text style={card.name} numberOfLines={2}>{product.brand_name}</Text>
        {product.generic_name && (
          <Text style={card.generic} numberOfLines={1}>{product.generic_name}</Text>
        )}
        {product.product_strength && (
          <Text style={card.strength} numberOfLines={1}>{product.product_strength}</Text>
        )}
        <View style={card.priceRow}>
          <Text style={card.price}>{formatNaira(price)}</Text>
          {hasDiscount && (
            <Text style={card.strikePrice}>{formatNaira(product.selling_price)}</Text>
          )}
        </View>
        {product.minimum_order && product.minimum_order > 1 && (
          <Text style={card.minOrder}>Min. {product.minimum_order} units</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:   Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  backBtn:    { marginTop: 3, padding: 4 },
  heading:    { ...type.h2, color: Colors.ink },
  subheading: { ...type.caption, color: Colors.ink4, marginTop: 2 },

  searchWrap: { padding: 12, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.line },
  searchBox:  {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.bg,
    borderRadius:      12,
    paddingHorizontal: 12,
    height:            42,
    gap:               8,
    borderWidth:       1,
    borderColor:       Colors.line,
  },
  searchInput: { flex: 1, ...type.body, color: Colors.ink },

  guestBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   10,
    backgroundColor:   Colors.brandLight,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.brand + '40',
  },
  guestBannerText: { flex: 1, ...type.label, color: Colors.brand },

  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  grid:  { padding: 12, gap: 12 },
  row:   { gap: 12 },
});

const card = StyleSheet.create({
  wrap: {
    flex:            1,
    backgroundColor: Colors.white,
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.05,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       2,
  },
  imageWrap: {
    height:          140,
    backgroundColor: Colors.bgMuted,
    position:        'relative',
  },
  image:          { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position:          'absolute',
    top:               8,
    right:             8,
    backgroundColor:   Colors.danger,
    borderRadius:      8,
    paddingHorizontal: 7,
    paddingVertical:   3,
  },
  discountText: { ...type.overline, color: Colors.white, fontSize: 10 },

  info:     { padding: 12, gap: 3 },
  category: { ...type.overline, color: Colors.brand, fontSize: 9 },
  name:     { ...type.label, color: Colors.ink, lineHeight: 18 },
  generic:  { ...type.caption, color: Colors.ink4 },
  strength: { ...type.caption, color: Colors.ink4, fontStyle: 'italic' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  price:    { ...type.h4, color: Colors.ink },
  strikePrice: { ...type.caption, color: Colors.ink4, textDecorationLine: 'line-through' },
  minOrder: { ...type.caption, color: Colors.warning, marginTop: 1 },
});
