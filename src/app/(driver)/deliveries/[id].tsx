import React from 'react';
import {
  Alert,
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
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/format';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

// Note: GET /api/deliveries/:id does not exist on the server.
// We query the driver's delivery list and find by id.

interface Delivery {
  id:            number;
  tracking_code: string;
  status:        string;
  dispatched_at: string | null;
  delivered_at:  string | null;
  notes:         string | null;
  order: {
    id:               number;
    order_number:     string;
    order_status:     string;
    delivery_address: string;
    delivery_city:    string;
    delivery_state:   string;
    delivery_notes:   string | null;
    customer: {
      first_name: string;
      last_name:  string;
      phone:      string | null;
    } | null;
    items?: Array<{
      quantity: number;
      product: { brand_name: string };
    }>;
  } | null;
}

interface DeliveriesResponse {
  records: Delivery[];
}

// Driver delivery status transitions (PATCH /api/deliveries/:id)
const NEXT_STATUS: Record<string, string | null> = {
  ASSIGNED:         'IN_TRANSIT',
  IN_TRANSIT:       'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
  DELIVERED:        null,
  FAILED:           null,
  RETURNED:         null,
  AWAITING_DISPATCH: null,
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  IN_TRANSIT:       '🚗 Start Transit',
  OUT_FOR_DELIVERY: '🏠 Out for Delivery',
  DELIVERED:        '✅ Mark Delivered',
};

export default function DeliveryDetail() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();

  // Query the list, find by id — server has no single-delivery GET
  const { data: delivery, isLoading, refetch, isRefetching } = useQuery({
    queryKey:        ['driver-delivery', id],
    queryFn:         async () => {
      const res = await api.get<DeliveriesResponse>('/api/deliveries');
      const found = (res?.records ?? []).find(d => String(d.id) === id);
      if (!found) throw new Error('Delivery not found');
      return found;
    },
    refetchInterval: 20_000,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/api/deliveries/${id}`, { status }),
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['driver-delivery', id] });
      qc.invalidateQueries({ queryKey: ['driver-deliveries'] });
      qc.invalidateQueries({ queryKey: ['driver-history'] });
      toast.success(`Status updated to ${status.replace(/_/g, ' ').toLowerCase()}`);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update status.');
    },
  });

  const nextStatus = delivery ? NEXT_STATUS[delivery.status] : null;
  const nextLabel  = nextStatus ? (NEXT_STATUS_LABEL[nextStatus] ?? `Set ${nextStatus}`) : null;

  function handleUpdateStatus() {
    if (!nextStatus) return;
    const isFinal = nextStatus === 'DELIVERED';
    Alert.alert(
      'Confirm Update',
      isFinal
        ? 'Mark this delivery as DELIVERED? This cannot be undone.'
        : `Move status to "${nextStatus.replace(/_/g, ' ')}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => updateStatus.mutate(nextStatus) },
      ],
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        title={delivery ? (delivery.order?.order_number ?? `Delivery #${id}`) : `Delivery #${id}`}
        back
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />}
      >
        {isLoading ? (
          <View style={{ gap: 16 }}>
            <Skeleton height={160} radius={16} />
            <Skeleton height={120} radius={16} />
            <Skeleton height={80} radius={16} />
          </View>
        ) : delivery ? (
          <>
            {/* Status card */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.trackLabel}>Tracking</Text>
                <Text style={styles.trackCode}>{delivery.tracking_code}</Text>
              </View>
              <View style={[styles.statusRow, { marginTop: 10 }]}>
                <Text style={styles.trackLabel}>Status</Text>
                <StatusBadge status={delivery.status} type="delivery" />
              </View>
              {delivery.dispatched_at && (
                <InfoRow label="Dispatched" value={formatDate(delivery.dispatched_at)} />
              )}
              {delivery.delivered_at && (
                <InfoRow label="Delivered" value={formatDate(delivery.delivered_at)} />
              )}
            </View>

            {/* Delivery address */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📍 Delivery Address</Text>
              <Text style={styles.address}>
                {delivery.order?.delivery_address},{'\n'}
                {delivery.order?.delivery_city}, {delivery.order?.delivery_state}
              </Text>
              {delivery.order?.customer?.phone && (
                <Text style={styles.phone}>📞 {delivery.order.customer.phone}</Text>
              )}
              {delivery.order?.delivery_notes && (
                <Text style={styles.deliveryNotes}>Note: {delivery.order.delivery_notes}</Text>
              )}
            </View>

            {/* Customer */}
            {delivery.order?.customer && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>👤 Customer</Text>
                <Text style={styles.customerName}>
                  {delivery.order.customer.first_name} {delivery.order.customer.last_name}
                </Text>
              </View>
            )}

            {/* Items */}
            {(delivery.order?.items?.length ?? 0) > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📦 Items</Text>
                {delivery.order!.items!.map((item, i) => (
                  <Text key={i} style={styles.itemLine}>
                    • {item.product?.brand_name} ×{item.quantity}
                  </Text>
                ))}
              </View>
            )}

            {/* Action button */}
            {nextLabel && (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={updateStatus.isPending}
                onPress={handleUpdateStatus}
              >
                {nextLabel}
              </Button>
            )}

            {delivery.status === 'DELIVERED' && (
              <View style={styles.doneCard}>
                <Text style={styles.doneText}>✅ Delivery complete</Text>
              </View>
            )}

            {delivery.status === 'FAILED' && (
              <View style={[styles.doneCard, { borderColor: Colors.danger, backgroundColor: Colors.danger + '10' }]}>
                <Text style={[styles.doneText, { color: Colors.danger }]}>❌ Delivery failed</Text>
              </View>
            )}

            <View style={{ height: 16 }} />
          </>
        ) : (
          <View style={{ padding: 20 }}>
            <Text style={{ color: Colors.ink3, textAlign: 'center' }}>Delivery not found. Pull to refresh.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 12 },

  statusCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackLabel: { fontSize: 13, color: Colors.ink3 },
  trackCode:  { fontSize: 14, fontWeight: '700', color: Colors.brand },
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  infoLabel:  { fontSize: 13, color: Colors.ink3 },
  infoValue:  { fontSize: 13, color: Colors.ink, fontWeight: '600' },

  card:          { backgroundColor: Colors.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 6 },
  cardTitle:     { fontSize: 13, fontWeight: '700', color: Colors.ink3, marginBottom: 4 },
  address:       { fontSize: 15, fontWeight: '600', color: Colors.ink, lineHeight: 22 },
  phone:         { fontSize: 14, color: Colors.teal },
  deliveryNotes: { fontSize: 13, color: Colors.ink4, fontStyle: 'italic' },
  customerName:  { fontSize: 15, fontWeight: '600', color: Colors.ink },
  itemLine:      { fontSize: 14, color: Colors.ink2, lineHeight: 22 },

  doneCard: { backgroundColor: Colors.success + '15', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.success },
  doneText: { fontSize: 16, fontWeight: '700', color: Colors.success },
});
