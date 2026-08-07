import React from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNaira, formatDate } from '@/lib/format';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

interface OrderItem {
  id:          number;
  quantity:    number;
  unit_price:  number;
  subtotal:    number;
  product: {
    brand_name:       string;
    generic_name:     string | null;
    product_strength: string | null;
    sku:              string;
    primary_image:    string | null;
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
  notes:            string | null;
  subtotal:         number;
  delivery_fee:     number;
  total:            number;
  created_at:       string;
  items:            OrderItem[];
  customer: {
    first_name: string;
    last_name:  string;
    email:      string;
    phone:      string | null;
  } | null;
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

// Server-enforced transitions only
const NEXT_STATUSES: Record<string, string[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED:  [],
  CANCELLED:  [],
};

export default function StaffOrderDetail() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();

  const { data: order, isLoading, refetch, isRefetching } = useQuery({
    queryKey:        ['staff-order', id],
    queryFn:         () => api.get<{ order: OrderDetail }>(`/api/orders/${id}`).then(r => r.order),
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/orders/${id}/status`, { status }),
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['staff-order', id] });
      qc.invalidateQueries({ queryKey: ['staff-orders'] });
      toast.success(`Order moved to ${status.charAt(0) + status.slice(1).toLowerCase()}`);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Status update failed.');
    },
  });

  function confirmStatus(status: string) {
    const isCancelling = status === 'CANCELLED';
    Alert.alert(
      isCancelling ? 'Cancel Order' : 'Update Status',
      isCancelling
        ? 'Are you sure you want to cancel this order? This cannot be undone.'
        : `Move order to "${status.charAt(0) + status.slice(1).toLowerCase()}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: isCancelling ? 'Cancel Order' : 'Confirm',
          style: isCancelling ? 'destructive' : 'default',
          onPress: () => updateStatus.mutate(status),
        },
      ],
    );
  }

  const nextStatuses = order ? (NEXT_STATUSES[order.status] ?? []) : [];

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
            {/* Status card */}
            <View style={styles.card}>
              <InfoRow label="Order Status"><StatusBadge status={order.status} type="order" /></InfoRow>
              <InfoRow label="Payment"><StatusBadge status={order.payment_status} type="payment" /></InfoRow>
              {order.delivery && (
                <InfoRow label="Delivery"><StatusBadge status={order.delivery.status} type="delivery" /></InfoRow>
              )}
              <InfoRow label="Placed" value={formatDate(order.created_at)} />
              <InfoRow label="Deliver to" value={`${order.delivery_address}, ${order.delivery_city}, ${order.delivery_state}`} last />
            </View>

            {/* Customer */}
            {order.customer && (
              <View style={styles.card}>
                <InfoRow label="Customer" value={`${order.customer.first_name} ${order.customer.last_name}`} />
                <InfoRow label="Email"    value={order.customer.email} />
                {order.customer.phone && (
                  <InfoRow label="Phone" value={order.customer.phone} last />
                )}
                {!order.customer.phone && <InfoRow label="" value="" last />}
              </View>
            )}

            {/* Driver info if dispatched */}
            {order.delivery?.driver && (
              <View style={[styles.card, styles.driverCard]}>
                <Text style={styles.driverTitle}>🚴 Driver Assigned</Text>
                <Text style={styles.driverName}>
                  {order.delivery.driver.first_name} {order.delivery.driver.last_name}
                </Text>
                {order.delivery.driver.phone && (
                  <Text style={styles.driverPhone}>{order.delivery.driver.phone}</Text>
                )}
                {order.delivery.tracking_code && (
                  <Text style={styles.tracking}>Tracking: {order.delivery.tracking_code}</Text>
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
                <Text style={{ fontSize: 14, color: Colors.ink2, lineHeight: 20 }}>{order.notes}</Text>
              </View>
            )}

            {/* Status actions */}
            {nextStatuses.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Update Status</Text>
                {nextStatuses.map(status => (
                  <Pressable
                    key={status}
                    style={[styles.actionBtn, status === 'CANCELLED' && styles.actionBtnDanger]}
                    onPress={() => confirmStatus(status)}
                    disabled={updateStatus.isPending}
                  >
                    <StatusBadge status={status} type="order" />
                    <Text style={[styles.actionBtnText, status === 'CANCELLED' && { color: Colors.danger }]}>
                      {status === 'CANCELLED' ? '🚫 Cancel this order' : `→ Mark as ${status.charAt(0) + status.slice(1).toLowerCase()}`}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            {(order.status === 'DELIVERED' || order.status === 'CANCELLED') && (
              <View style={[styles.terminalCard, { borderLeftColor: order.status === 'DELIVERED' ? Colors.success : Colors.danger }]}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: order.status === 'DELIVERED' ? Colors.success : Colors.danger }}>
                  {order.status === 'DELIVERED' ? '✅ Order completed' : '🚫 Order cancelled'}
                </Text>
              </View>
            )}

            <View style={{ height: 24 }} />
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
  if (!label && !value && !children) return null;
  return (
    <View style={[ir.wrap, !last && ir.border]}>
      <Text style={ir.label}>{label}</Text>
      {children ?? <Text style={ir.value} numberOfLines={3}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  content:    { padding: 16, gap: 12 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: Colors.ink, marginTop: 4 },
  card:       { backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  driverCard: { padding: 14, gap: 4, overflow: 'hidden' },
  driverTitle:{ fontSize: 13, fontWeight: '700', color: Colors.teal },
  driverName: { fontSize: 15, fontWeight: '700', color: Colors.ink },
  driverPhone:{ fontSize: 13, color: Colors.ink3 },
  tracking:   { fontSize: 12, color: Colors.brand, marginTop: 2 },
  itemRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 8 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  itemName:   { fontSize: 14, fontWeight: '600', color: Colors.ink },
  itemSub:    { fontSize: 12, color: Colors.ink4 },
  itemMeta:   { fontSize: 12, color: Colors.ink4, marginTop: 2 },
  itemTotal:  { fontSize: 14, fontWeight: '700', color: Colors.ink },
  totalsCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, color: Colors.ink3 },
  totalValue: { fontSize: 14, color: Colors.ink },
  grandRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.line },
  grandLabel: { fontSize: 16, fontWeight: '700', color: Colors.ink },
  grandValue: { fontSize: 20, fontWeight: '800', color: Colors.brand },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  actionBtnDanger:{ borderWidth: 1, borderColor: Colors.danger + '40' },
  actionBtnText:  { fontSize: 14, color: Colors.ink2, fontWeight: '600' },
  terminalCard:   { borderRadius: 12, padding: 14, borderLeftWidth: 4, backgroundColor: Colors.bgSubtle },
});

const ir = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  label:  { fontSize: 13, color: Colors.ink3, flex: 1 },
  value:  { fontSize: 14, fontWeight: '600', color: Colors.ink, maxWidth: '55%', textAlign: 'right' },
});
