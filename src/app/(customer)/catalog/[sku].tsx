import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNaira } from '@/lib/format';
import { api } from '@/lib/api-client';
import { toast } from '@/lib/toast';

interface ProductDetail {
  id:                  number;
  sku:                 string;
  brand_name:          string;
  generic_name:        string;
  product_strength:    string | null;
  pack_size:           string | null;
  selling_price:       number;
  final_price:         number | null;
  discount_percentage: number | null;
  total_stock:         number;
  in_stock:            boolean;
  minimum_order:       number;
  category:            { id: number; name: string } | null;
  manufacturer:        { id: number; name: string } | null;
  images:              Array<{ id: number; url: string; is_primary: boolean }>;
}

export default function ProductDetailScreen() {
  const { sku }  = useLocalSearchParams<{ sku: string }>();
  const insets   = useSafeAreaInsets();
  const qc       = useQueryClient();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', sku],
    queryFn:  () =>
      api.get<{ product: ProductDetail }>(`/api/catalog/products/${sku}`)
         .then(r => r.product),
  });

  const addToCart = useMutation({
    mutationFn: () =>
      api.post('/api/cart/items', {
        product_id: product!.id,
        quantity:   qty,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      toast.success(`${product?.brand_name} × ${qty} added.`, 'Added to cart 🛒');
    },
    onError: () => toast.error('Could not add to cart. Please try again.'),
  });

  const displayPrice = product?.final_price ?? product?.selling_price ?? 0;
  const hasDiscount  = product?.final_price !== null && product?.final_price !== undefined
    && product.final_price < product.selling_price;
  const maxQty = product?.total_stock ?? 1;
  const minQty = product?.minimum_order ?? 1;

  const primaryImage = product?.images?.find(i => i.is_primary)?.url
    ?? product?.images?.[0]?.url
    ?? null;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        title={product ? product.brand_name : 'Product'}
        back
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {isLoading ? (
          <>
            <Skeleton height={280} radius={0} />
            <View style={styles.body}>
              <Skeleton width="40%" height={12} />
              <Skeleton height={20} style={{ marginTop: 8 }} />
              <Skeleton width="30%" height={24} style={{ marginTop: 12 }} />
              <Skeleton height={80} style={{ marginTop: 20 }} />
            </View>
          </>
        ) : product ? (
          <>
            {/* Image */}
            <View style={styles.imgWrap}>
              {primaryImage ? (
                <Image source={{ uri: primaryImage }} style={styles.img} resizeMode="cover" />
              ) : (
                <View style={[styles.img, styles.imgPlaceholder]}>
                  <Text style={{ fontSize: 64 }}>💊</Text>
                </View>
              )}
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    -{product.discount_percentage?.toFixed(0)}% OFF
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.body}>
              {product.category && (
                <Text style={styles.category}>{product.category.name}</Text>
              )}
              <Text style={styles.name}>{product.brand_name}</Text>
              <Text style={styles.generic}>{product.generic_name}</Text>
              {product.product_strength && (
                <Text style={styles.strength}>{product.product_strength}</Text>
              )}

              {/* Price */}
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatNaira(displayPrice)}</Text>
                {hasDiscount && (
                  <Text style={styles.oldPrice}>{formatNaira(product.selling_price)}</Text>
                )}
              </View>

              {/* Stock */}
              <Text style={[
                styles.stockText,
                { color: product.in_stock ? Colors.success : Colors.danger },
              ]}>
                {product.in_stock ? `${product.total_stock} in stock` : 'Out of stock'}
              </Text>

              {product.pack_size && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Pack size</Text>
                  <Text style={styles.metaValue}>{product.pack_size}</Text>
                </View>
              )}
              {product.manufacturer && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Manufacturer</Text>
                  <Text style={styles.metaValue}>{product.manufacturer.name}</Text>
                </View>
              )}
              {product.minimum_order > 1 && (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Min. order</Text>
                  <Text style={styles.metaValue}>{product.minimum_order} units</Text>
                </View>
              )}

              {/* Qty */}
              <View style={styles.qtySection}>
                <Text style={styles.qtyLabel}>Quantity</Text>
                <View style={styles.qtyCtrl}>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setQty(q => Math.max(minQty, q - 1))}
                    disabled={qty <= minQty}
                  >−</Button>
                  <Text style={styles.qtyNum}>{qty}</Text>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => setQty(q => Math.min(maxQty, q + 1))}
                    disabled={qty >= maxQty}
                  >+</Button>
                </View>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      {product && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={addToCart.isPending}
            disabled={!product.in_stock}
            onPress={() => addToCart.mutate()}
          >
            {product.in_stock ? 'Add to Cart' : 'Out of Stock'}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.white },
  content: { paddingBottom: 100 },

  imgWrap:         { width: '100%', height: 280, backgroundColor: Colors.bgMuted, position: 'relative' },
  img:             { width: '100%', height: '100%' },
  imgPlaceholder:  { alignItems: 'center', justifyContent: 'center' },
  discountBadge:   {
    position:        'absolute',
    top:             12,
    right:           12,
    backgroundColor: Colors.danger,
    borderRadius:    8,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  discountText: { fontSize: 12, fontWeight: '800', color: Colors.white },

  body:       { padding: 20, gap: 6 },
  category:   { fontSize: 11, fontWeight: '700', color: Colors.teal, textTransform: 'uppercase', letterSpacing: 0.6 },
  name:       { fontSize: 22, fontWeight: '800', color: Colors.ink, lineHeight: 28 },
  generic:    { fontSize: 14, color: Colors.ink3 },
  strength:   { fontSize: 13, color: Colors.ink4, fontStyle: 'italic' },

  priceRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  price:      { fontSize: 26, fontWeight: '800', color: Colors.brand },
  oldPrice:   { fontSize: 16, color: Colors.ink4, textDecorationLine: 'line-through' },

  stockText: { fontSize: 13, fontWeight: '600', marginTop: 4 },

  metaRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.line },
  metaLabel: { fontSize: 13, color: Colors.ink3 },
  metaValue: { fontSize: 13, fontWeight: '600', color: Colors.ink },

  qtySection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  qtyLabel:   { fontSize: 15, fontWeight: '600', color: Colors.ink },
  qtyCtrl:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyNum:     { fontSize: 18, fontWeight: '700', color: Colors.ink, minWidth: 30, textAlign: 'center' },

  footer: {
    padding:           16,
    paddingTop:        12,
    backgroundColor:   Colors.white,
    borderTopWidth:    1,
    borderTopColor:    Colors.line,
  },
});
