import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatNaira } from '@/lib/format';
import { api } from '@/lib/api-client';

// ── Types (matches /api/catalog/products response) ───────────────────────────

interface CatalogProduct {
  id:                  number;
  sku:                 string;
  brand_name:          string;
  generic_name:        string;
  product_strength:    string | null;
  pack_size:           string | null;
  selling_price:       number;
  final_price:         number | null;
  discount_percentage: number | null;
  primary_image:       string | null;
  in_stock:            boolean;
  total_stock:         number;
  category:            { id: number; name: string } | null;
}

interface CatalogResponse {
  records:    CatalogProduct[];
  pagination: { total: number; current_page: number; per_page: number; total_pages: number };
}

export default function Catalog() {
  const insets   = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Simple debounce
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function handleSearch(text: string) {
    setSearch(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedSearch(text), 400);
  }

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['catalog', debouncedSearch],
    queryFn:  () =>
      api.get<CatalogResponse>(
        `/api/catalog/products${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''}`,
      ),
  });

  const products = data?.records ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appTitle}>EnvolveCare</Text>
          <Text style={styles.subtitle}>What do you need today?</Text>
        </View>
        <Pressable style={styles.notifBtn}>
          <Text style={{ fontSize: 22 }}>🔔</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search medicines, vitamins…"
            placeholderTextColor={Colors.ink4}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => { setSearch(''); setDebouncedSearch(''); }} hitSlop={8}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.cardWrap}><ProductCardSkeleton /></View>
          ))}
        </ScrollView>
      ) : isError ? (
        <EmptyState
          icon="⚠️"
          title="Couldn't load products"
          subtitle="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No results"
          subtitle={debouncedSearch ? `Nothing matched "${debouncedSearch}"` : 'No products available right now.'}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.sku}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.cardWrap}
              onPress={() => router.push(`/(customer)/catalog/${item.sku}`)}
            >
              <ProductCard product={item} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const displayPrice = product.final_price ?? product.selling_price;
  const hasDiscount  = product.final_price !== null && product.final_price < product.selling_price;

  return (
    <View style={card.wrap}>
      <View style={card.imgWrap}>
        {product.primary_image ? (
          <Image source={{ uri: product.primary_image }} style={card.img} resizeMode="cover" />
        ) : (
          <View style={[card.img, card.imgPlaceholder]}>
            <Text style={{ fontSize: 36 }}>💊</Text>
          </View>
        )}
        {hasDiscount && (
          <View style={card.discountBadge}>
            <Text style={card.discountText}>-{product.discount_percentage?.toFixed(0)}%</Text>
          </View>
        )}
      </View>
      <View style={card.body}>
        {product.category && (
          <Text style={card.category} numberOfLines={1}>{product.category.name}</Text>
        )}
        <Text style={card.name} numberOfLines={2}>
          {product.brand_name}
          {product.product_strength ? ` ${product.product_strength}` : ''}
        </Text>
        <Text style={card.generic} numberOfLines={1}>{product.generic_name}</Text>
        <View style={card.priceRow}>
          <Text style={card.price}>{formatNaira(displayPrice)}</Text>
          {hasDiscount && (
            <Text style={card.oldPrice}>{formatNaira(product.selling_price)}</Text>
          )}
        </View>
        {!product.in_stock && (
          <Text style={card.outOfStock}>Out of stock</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  topBar:  {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingBottom:     12,
    backgroundColor:   Colors.white,
  },
  appTitle:  { fontSize: 20, fontWeight: '800', color: Colors.ink },
  subtitle:  { fontSize: 13, color: Colors.ink3, marginTop: 1 },
  notifBtn:  { padding: 4 },

  searchRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.white },
  searchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.bg,
    borderRadius:      12,
    paddingHorizontal: 12,
    height:            44,
    gap:               8,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.ink },
  clearIcon:   { fontSize: 13, color: Colors.ink4, fontWeight: '700' },

  grid: { padding: 12 },
  row:  { gap: 12, marginBottom: 12 },
  cardWrap: { flex: 1 },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.white,
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.05,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       2,
  },
  imgWrap:       { width: '100%', aspectRatio: 1, position: 'relative' },
  img:           { width: '100%', height: '100%' },
  imgPlaceholder:{ backgroundColor: Colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  discountBadge: {
    position:        'absolute',
    top:             8,
    right:           8,
    backgroundColor: Colors.danger,
    borderRadius:    6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  discountText:  { fontSize: 10, fontWeight: '800', color: Colors.white },
  body:          { padding: 10 },
  category:      { fontSize: 10, fontWeight: '700', color: Colors.teal, textTransform: 'uppercase', letterSpacing: 0.5 },
  name:          { fontSize: 13, fontWeight: '700', color: Colors.ink, marginTop: 3, lineHeight: 18 },
  generic:       { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  priceRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  price:         { fontSize: 15, fontWeight: '800', color: Colors.brand },
  oldPrice:      { fontSize: 12, color: Colors.ink4, textDecorationLine: 'line-through' },
  outOfStock:    { fontSize: 11, color: Colors.danger, fontWeight: '600', marginTop: 4 },
});
