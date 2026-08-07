/**
 * Public product detail — accessible without login.
 * GET /api/catalog/products/{sku} (no auth required)
 */

import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNaira } from '@/lib/format';
import { API_BASE, MOBILE_HEADERS } from '@/constants/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductImage { id: number; url: string; is_primary: boolean }

interface Product {
  id:                  number;
  sku:                 string;
  brand_name:          string;
  generic_name:        string | null;
  product_strength:    string | null;
  pack_size:           string | null;
  quantity_per_carton: number | null;
  allow_unit_sale:     boolean;
  minimum_order:       number | null;
  selling_price:       number;
  final_price:         number | null;
  discount_percentage: number | null;
  requires_prescription: boolean;
  in_stock:            boolean;
  total_stock:         number;
  category:            { id: number; name: string } | null;
  manufacturer:        { id: number; name: string } | null;
  images:              ProductImage[];
}

async function fetchProduct(sku: string): Promise<{ product: Product }> {
  const res  = await fetch(`${API_BASE}/api/catalog/products/${sku}`, { headers: MOBILE_HEADERS });
  const json = await res.json();
  return json.data;
}

export default function PublicProductDetail() {
  const { sku }    = useLocalSearchParams<{ sku: string }>();
  const insets     = useSafeAreaInsets();
  const [activeImg, setActiveImg] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-product', sku],
    queryFn:  () => fetchProduct(sku!),
    enabled:  !!sku,
  });

  const product = data?.product;

  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Icon name="back" size={18} color={Colors.ink} />
          </Pressable>
        </View>
        <Skeleton height={320} radius={0} />
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton height={28} radius={8} />
          <Skeleton height={18} radius={8} />
          <Skeleton height={18} radius={8} />
        </View>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Icon name="back" size={18} color={Colors.ink} />
          </Pressable>
        </View>
        <View style={styles.errorState}>
          <Icon name="alert" size={32} color={Colors.danger} />
          <Text style={styles.errorText}>Product not found.</Text>
          <Button variant="outline" size="sm" onPress={() => router.back()}>Go Back</Button>
        </View>
      </View>
    );
  }

  const displayPrice  = product.final_price ?? product.selling_price;
  const hasDiscount   = !!product.discount_percentage && product.discount_percentage > 0;
  const images        = product.images.length > 0 ? product.images : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Back bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="back" size={18} color={Colors.ink} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>{product.brand_name}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Images */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                setActiveImg(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
              }}
            >
              {images.map((img, i) => (
                <Image
                  key={img.id}
                  source={{ uri: img.url }}
                  style={{ width: SCREEN_WIDTH, height: 300 }}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeImg && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Icon name="product" size={52} color={Colors.ink4} />
          </View>
        )}

        <View style={styles.content}>
          {/* Category */}
          {product.category && (
            <Text style={styles.category}>{product.category.name}</Text>
          )}

          {/* Title */}
          <Text style={styles.name}>{product.brand_name}</Text>
          {product.generic_name && (
            <Text style={styles.generic}>{product.generic_name}</Text>
          )}

          {/* Details row */}
          <View style={styles.detailsRow}>
            {product.product_strength && (
              <View style={styles.chip}><Text style={styles.chipText}>{product.product_strength}</Text></View>
            )}
            {product.pack_size && (
              <View style={styles.chip}><Text style={styles.chipText}>{product.pack_size}</Text></View>
            )}
            {product.manufacturer && (
              <View style={styles.chip}><Text style={styles.chipText}>{product.manufacturer.name}</Text></View>
            )}
          </View>

          {/* Prescription warning */}
          {product.requires_prescription && (
            <View style={styles.rxWarning}>
              <Icon name="clipboard" size={16} color={Colors.warning} />
              <Text style={styles.rxText}>Requires a valid prescription</Text>
            </View>
          )}

          {/* Price */}
          <View style={styles.priceSection}>
            <Text style={styles.price}>{formatNaira(displayPrice)}</Text>
            {hasDiscount && (
              <View style={styles.priceDetails}>
                <Text style={styles.strikePrice}>{formatNaira(product.selling_price)}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>Save {product.discount_percentage}%</Text>
                </View>
              </View>
            )}
          </View>

          {/* Stock */}
          <View style={styles.stockRow}>
            <View style={[styles.stockDot, { backgroundColor: product.in_stock ? Colors.success : Colors.danger }]} />
            <Text style={[styles.stockText, { color: product.in_stock ? Colors.success : Colors.danger }]}>
              {product.in_stock
                ? `In stock${product.total_stock > 0 ? ` · ${product.total_stock} units` : ''}`
                : 'Out of stock'}
            </Text>
          </View>

          {product.minimum_order && product.minimum_order > 1 && (
            <Text style={styles.minOrder}>Minimum order: {product.minimum_order} units</Text>
          )}

          {/* SKU */}
          <View style={styles.skuRow}>
            <Text style={styles.skuLabel}>SKU</Text>
            <Text style={styles.skuValue}>{product.sku}</Text>
          </View>
        </View>
      </ScrollView>

      {/* CTA footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.footerInner}>
          <Button
            variant="outline"
            size="lg"
            style={{ flex: 1 }}
            onPress={() => router.replace('/(auth)/sign-in')}
          >
            Sign In
          </Button>
          <Button
            variant="primary"
            size="lg"
            style={{ flex: 1 }}
            onPress={() => router.replace('/(auth)/sign-in')}
          >
            Order Now
          </Button>
        </View>
        <Text style={styles.footerNote}>
          Sign in as a customer to add items to your cart
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.white },

  topBar:  {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
    backgroundColor:   Colors.white,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { ...type.h4, color: Colors.ink, flex: 1, textAlign: 'center' },

  imagePlaceholder: {
    height:         300,
    backgroundColor: Colors.bgMuted,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dots:    { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.line },
  dotActive: { backgroundColor: Colors.brand, width: 18 },

  content: { padding: 20, gap: 8 },

  category: { ...type.overline, color: Colors.brand },
  name:     { ...type.title, color: Colors.ink, marginTop: 2 },
  generic:  { ...type.bodySm, color: Colors.ink3 },

  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip:       { backgroundColor: Colors.bgMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  chipText:   { ...type.caption, color: Colors.ink3 },

  rxWarning: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: Colors.warningLight,
    borderRadius:    12,
    padding:         12,
    marginTop:       4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  rxText: { ...type.bodySm, color: Colors.warning, flex: 1 },

  priceSection: { marginTop: 12, gap: 4 },
  price:        { ...type.hero, color: Colors.ink },
  priceDetails: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strikePrice:  { ...type.bodySm, color: Colors.ink4, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: Colors.danger + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  discountText: { ...type.label, color: Colors.danger, fontSize: 11 },

  stockRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockDot:   { width: 8, height: 8, borderRadius: 4 },
  stockText:  { ...type.bodyMed },
  minOrder:   { ...type.caption, color: Colors.warning },

  skuRow:   { flexDirection: 'row', gap: 8, marginTop: 4 },
  skuLabel: { ...type.overline, color: Colors.ink4 },
  skuValue: { ...type.caption, color: Colors.ink3, fontFamily: 'monospace' },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText:  { ...type.body, color: Colors.ink3 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 0.5, borderTopColor: Colors.line,
    padding: 16, paddingTop: 12, gap: 8,
  },
  footerInner: { flexDirection: 'row', gap: 12 },
  footerNote:  { ...type.caption, color: Colors.ink4, textAlign: 'center' },
});
