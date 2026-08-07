import React from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate, formatNaira } from '@/lib/format';
import { api } from '@/lib/api-client';

interface Delivery {
  id:            number;
  tracking_code: string;
  status:        string;
  delivered_at:  string | null;
  order: {
    order_number:   string;
    total:          number;
    delivery_city:  string;
    delivery_state: string;
    customer: {
      first_name: string;
      last_name:  string;
    } | null;
  } | null;
}

interface DeliveriesResponse {
  records:    Delivery[];
  pagination: { total: number };
}

export default function DriverHistory() {
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey:        ['driver-history'],
    queryFn:         () => api.get<DeliveriesResponse>('/api/deliveries?status=DELIVERED'),
    refetchInterval: 60_000,
  });

  const deliveries = data?.records ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Delivery History</Text>
        {!isLoading && <Text style={styles.count}>{deliveries.length} deliveries</Text>}
      </View>

      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
        </View>
      ) : isError ? (
        <EmptyState icon="⚠️" title="Couldn't load history" actionLabel="Retry" onAction={() => refetch()} />
      ) : deliveries.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No completed deliveries"
          subtitle="Your completed deliveries will appear here."
        />
      ) : (
        <FlatList
          data={deliveries}
          keyExtractor={d => String(d.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />}
          renderItem={({ item }) => {
            const customer = item.order?.customer;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNum}>{item.order?.order_number ?? `DEL-${item.id}`}</Text>
                    {customer && (
                      <Text style={styles.customerName}>
                        {customer.first_name} {customer.last_name}
                      </Text>
                    )}
                  </View>
                  <StatusBadge status={item.status} type="delivery" />
                </View>

                <View style={styles.meta}>
                  <Text style={styles.location}>
                    📍 {item.order?.delivery_city}, {item.order?.delivery_state}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {item.order?.total ? (
                      <Text style={styles.amount}>{formatNaira(item.order.total)}</Text>
                    ) : null}
                    {item.delivered_at && (
                      <Text style={styles.date}>{formatDate(item.delivered_at)}</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.bg },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  heading:  { fontSize: 20, fontWeight: '800', color: Colors.ink },
  count:    { fontSize: 13, color: Colors.ink3 },
  skeletons:{ padding: 16, gap: 4 },
  list:     { padding: 16, gap: 10 },
  card:     { backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTop:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  orderNum: { fontSize: 14, fontWeight: '800', color: Colors.ink },
  customerName: { fontSize: 13, color: Colors.ink3, marginTop: 2 },
  meta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  location: { fontSize: 13, color: Colors.ink3 },
  amount:   { fontSize: 14, fontWeight: '700', color: Colors.ink },
  date:     { fontSize: 12, color: Colors.ink4 },
});
