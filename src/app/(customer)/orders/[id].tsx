import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNaira, formatDate } from '@/lib/format';
import { api } from '@/lib/api-client';

interface OrderItem {
  id:         number;
  quantity:   number;
  unit_price: number;
  subtotal:   number;
  product: {
    brand_name:    string;
    generic_name:  string | null;
    sku:           string;
    primary_image: string | null;
  };
}

interface OrderDetail {
  id:               number;
  order_number:     string;
  status:           string;
  payment_status:   string;
  delivery_address: string;
  delivery_city:    string;
  delivery_state:   string;
  subtotal:         number;
  delivery_fee:     number;
  total:            number;
  notes:            string | null;
  created_at:       string;
  items:            OrderItem[];
  delivery: {
    tracking_code: string;
    status:        string;
    dispatched_at: string | null;
    delivered_at:  string | null;
    driver: {
      first_name: string;
      last_name:  string;
      phone:      string | null;
    } | null;
  } | null;
}

export default function OrderDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();

  const { data: order, isLoading, refetch, isRefetching } = useQuery({
    queryKey:        ['customer-order', id],
    queryFn:         () => api.get<{ order: OrderDetail }>(`/api/orders/${id}`).then(r => r.order),
    refetchInterval: 30_000,
  });

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader title={order?.order_number ?? `Order #${id}`} back />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />}
      >
        {isLoading ? (
          <View style={{ gap: 16 }}>
            <Skeleton height={180} radius={16} />
            <Skeleton height={80} radius={16} />
            <Skeleton height={140} radius={16} />
          </View>
        ) : order ? (
          <>
            {/* Status */}
            <View style={styles.card}>
              <InfoRow label="Order Status"><StatusBadge status={order.status} type="order" /></InfoRow>
              <InfoRow label="Payment"><StatusBadge status={order.payment_status} type="payment" /></InfoRow>
              {order.delivery && (
                <InfoRow label="Delivery"><StatusBadge status={order.delivery.status} type="delivery" /></InfoRow>
              )}
              <InfoRow label="Placed" value={formatDate(order.created_at)} />
              <InfoRow label="Deliver to" value={`${order.delivery_address}, ${order.delivery_city}, ${order.delivery_state}`} last />
            </View>

            {/* Driver tracking */}
            {order.delivery?.driver && (
              <View style={styles.trackCard}>
                <Text style={styles.trackTitle}>🚴 Out for delivery</Text>
                <Text style={styles.trackSub}>
                  Driver: {order.delivery.driver.first_name} {order.delivery.driver.last_name}
                  {order.delivery.driver.phone ? ` · ${order.delivery.driver.phone}` : ''}
                </Text>
                {order.delivery.tracking_code && (
                  <Text style={styles.trackCode}>Tracking: {order.delivery.tracking_code}</Text>
                )}
              </View>
            )}

            {/* Items */}
            <Text style={styles.sectionTitle}>Items</Text>
            <View style={styles.card}>
              {order.items.map((item, idx) => (
                <View key={item.id} style={[styles.itemRow, idx < order.items.length - 1 && styles.itemBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.product.brand_name}</Text>
                    {item.product.generic_name && (
                      <Text style={styles.itemSub}>{item.product.generic_name}</Text>
                    )}
                    <Text style={styles.itemMeta}>{formatNaira(item.unit_price)} × {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatNaira(item.subtotal)}</Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={styles.totalsCard}>
              <TotalRow label="Subtotal"     value={formatNaira(order.subtotal)} />
              <TotalRow label="Delivery fee" value={formatNaira(order.delivery_fee)} />
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandValue}>{formatNaira(order.total)}</Text>
              </View>
            </View>

            {order.notes && (
              <View style={[styles.card, { padding: 14 }]}>
                <Text style={{ fontSize: 12, color: Colors.ink3, marginBottom: 4 }}>Delivery Notes</Text>
                <Text style={{ fontSize: 14, color: Colors.ink2, lineHeight: 21 }}>{order.notes}</Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value, children, last }: { label: string; value?: string; children?: React.ReactNode; last?: boolean }) {
  return (
    <View style={[ir.wrap, !last && ir.border]}>
      <Text style={ir.label}>{label}</Text>
      {children ?? <Text style={ir.value}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  content:     { padding: 16, gap: 12 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: Colors.ink, marginTop: 4 },
  card:        { backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  trackCard:   { backgroundColor: Colors.teal + '15', borderRadius: 14, padding: 16, borderLeftWidth: 4, borderLeftColor: Colors.teal, gap: 4 },
  trackTitle:  { fontSize: 15, fontWeight: '700', color: Colors.teal },
  trackSub:    { fontSize: 13, color: Colors.ink2 },
  trackCode:   { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  itemRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 8 },
  itemBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.line },
  itemName:    { fontSize: 14, fontWeight: '600', color: Colors.ink },
  itemSub:     { fontSize: 12, color: Colors.ink4 },
  itemMeta:    { fontSize: 12, color: Colors.ink4, marginTop: 2 },
  itemTotal:   { fontSize: 14, fontWeight: '700', color: Colors.ink },
  totalsCard:  { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel:  { fontSize: 14, color: Colors.ink3 },
  totalValue:  { fontSize: 14, color: Colors.ink },
  grandRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.line },
  grandLabel:  { fontSize: 16, fontWeight: '700', color: Colors.ink },
  grandValue:  { fontSize: 20, fontWeight: '800', color: Colors.brand },
});

const ir = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  label:  { fontSize: 13, color: Colors.ink3, flex: 1 },
  value:  { fontSize: 14, fontWeight: '600', color: Colors.ink, maxWidth: '55%', textAlign: 'right' },
});
