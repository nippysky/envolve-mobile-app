import React from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatNaira } from '@/lib/format';
import { api } from '@/lib/api-client';
import { toast } from '@/lib/toast';

// Response matches GET /api/cart → .data → { cart: { items, subtotal, item_count } }
interface CartItem {
  id:           number;
  product_id:   number;
  quantity:     number;
  unit_price:   number;
  subtotal:     number;
  brand_name:   string;
  generic_name: string;
  sku:          string;
  pack_size:    string | null;
  primary_image: string | null;
  in_stock:     boolean;
}

interface CartData {
  cart: {
    id?:        number;
    items:      CartItem[];
    subtotal:   number;
    item_count: number;
  };
}

export default function Cart() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cart'],
    queryFn:  () => api.get<CartData>('/api/cart'),
  });

  const cart  = data?.cart;
  const items = cart?.items ?? [];

  const removeItem = useMutation({
    mutationFn: (itemId: number) => api.delete(`/api/cart/items/${itemId}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cart'] }),
    onError:    () => toast.error('Could not remove item.'),
  });

  const updateQty = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: number; qty: number }) =>
      api.patch(`/api/cart/items/${itemId}`, { quantity: qty }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
    onError:   () => toast.error('Could not update quantity.'),
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Cart</Text>
        {items.length > 0 && (
          <Text style={styles.count}>{cart?.item_count} item{cart?.item_count !== 1 ? 's' : ''}</Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          subtitle="Browse the shop and add items to your cart."
          actionLabel="Shop now"
          onAction={() => router.push('/(customer)/catalog')}
        />
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />
            }
            renderItem={({ item }) => (
              <CartRow
                item={item}
                onRemove={() => removeItem.mutate(item.id)}
                onDecrement={() =>
                  item.quantity <= 1
                    ? removeItem.mutate(item.id)
                    : updateQty.mutate({ itemId: item.id, qty: item.quantity - 1 })
                }
                onIncrement={() => updateQty.mutate({ itemId: item.id, qty: item.quantity + 1 })}
                removing={removeItem.isPending}
              />
            )}
          />

          {/* Summary + CTA */}
          <View style={[styles.summary, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatNaira(cart?.subtotal ?? 0)}</Text>
            </View>
            <Text style={styles.deliveryNote}>Delivery fee calculated at checkout</Text>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => router.push('/(customer)/checkout')}
              style={{ marginTop: 12 }}
            >
              Proceed to Checkout
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

function CartRow({
  item,
  onRemove,
  onDecrement,
  onIncrement,
  removing,
}: {
  item:        CartItem;
  onRemove:    () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  removing:    boolean;
}) {
  return (
    <View style={row.wrap}>
      <View style={row.imgWrap}>
        {item.primary_image ? (
          <Image source={{ uri: item.primary_image }} style={row.img} resizeMode="cover" />
        ) : (
          <View style={[row.img, row.imgFallback]}>
            <Text style={{ fontSize: 22 }}>💊</Text>
          </View>
        )}
      </View>

      <View style={row.info}>
        <Text style={row.name} numberOfLines={2}>{item.brand_name}</Text>
        <Text style={row.generic} numberOfLines={1}>{item.generic_name}</Text>
        <Text style={row.unit}>{formatNaira(item.unit_price)} each</Text>

        <View style={row.controls}>
          <View style={row.qtyRow}>
            <Pressable onPress={onDecrement} style={row.qtyBtn} hitSlop={6}>
              <Text style={row.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={row.qty}>{item.quantity}</Text>
            <Pressable onPress={onIncrement} style={[row.qtyBtn, !item.in_stock && { opacity: 0.4 }]} hitSlop={6} disabled={!item.in_stock}>
              <Text style={row.qtyBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={row.lineTotal}>{formatNaira(item.subtotal)}</Text>
        </View>
      </View>

      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={[row.removeBtn, removing && { opacity: 0.4 }]}
        disabled={removing}
      >
        <Text style={{ fontSize: 16 }}>🗑️</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   16,
    backgroundColor:   Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  heading:   { fontSize: 20, fontWeight: '800', color: Colors.ink },
  count:     { fontSize: 13, color: Colors.ink3 },
  skeletons: { padding: 20, gap: 4 },
  list:      { padding: 16, gap: 12 },

  summary: {
    backgroundColor: Colors.white,
    borderTopWidth:  1,
    borderTopColor:  Colors.line,
    padding:         20,
  },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 15, color: Colors.ink2 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: Colors.ink },
  deliveryNote: { fontSize: 12, color: Colors.ink4, marginTop: 4 },
});

const row = StyleSheet.create({
  wrap: {
    flexDirection:   'row',
    backgroundColor: Colors.white,
    borderRadius:    16,
    padding:         12,
    gap:             12,
    alignItems:      'flex-start',
    shadowColor:     '#000',
    shadowOpacity:   0.04,
    shadowRadius:    6,
    elevation:       1,
  },
  imgWrap:    { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
  img:        { width: '100%', height: '100%' },
  imgFallback:{ backgroundColor: Colors.bgMuted, alignItems: 'center', justifyContent: 'center' },

  info:       { flex: 1 },
  name:       { fontSize: 14, fontWeight: '700', color: Colors.ink, lineHeight: 19 },
  generic:    { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  unit:       { fontSize: 12, color: Colors.ink4, marginTop: 2 },

  controls:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  qtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width:          30,
    height:         30,
    borderRadius:   8,
    backgroundColor: Colors.bgMuted,
    alignItems:     'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: Colors.ink },
  qty:        { fontSize: 15, fontWeight: '700', color: Colors.ink, minWidth: 20, textAlign: 'center' },
  lineTotal:  { fontSize: 15, fontWeight: '800', color: Colors.brand },
  removeBtn:  { padding: 4 },
});
