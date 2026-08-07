import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { RowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';
import { api } from '@/lib/api-client';

interface Delivery {
  id:            number;
  tracking_code: string;
  status:        string;
  dispatched_at: string | null;
  delivered_at:  string | null;
  order: {
    id:               number;
    order_number:     string;
    order_status:     string;
    delivery_address: string;
    delivery_city:    string;
    delivery_state:   string;
    customer: {
      first_name: string;
      last_name:  string;
      phone:      string | null;
    } | null;
  } | null;
}

interface DeliveriesResponse {
  records:    Delivery[];
  pagination: { total: number };
}

const ACTIVE_STATUSES = ['ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

export default function DriverDeliveries() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey:        ['driver-deliveries', filter],
    queryFn:         () => {
      const params = new URLSearchParams();
      if (filter === 'active') params.set('status', ACTIVE_STATUSES.join(','));
      const qs = params.toString();
      return api.get<DeliveriesResponse>(`/api/deliveries${qs ? `?${qs}` : ''}`);
    },
    refetchInterval: 20_000,
  });

  const deliveries = data?.records ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Deliveries</Text>
        <Text style={styles.count}>{deliveries.length}</Text>
      </View>

      <View style={styles.tabs}>
        {(['active', 'all'] as const).map(key => (
          <Pressable
            key={key}
            style={[styles.tab, filter === key && styles.tabActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.tabText, filter === key && styles.tabTextActive]}>
              {key === 'active' ? 'Active' : 'All'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
        </View>
      ) : isError ? (
        <EmptyState icon="⚠️" title="Couldn't load deliveries" actionLabel="Retry" onAction={() => refetch()} />
      ) : deliveries.length === 0 ? (
        <EmptyState
          icon="🚴"
          title={filter === 'active' ? 'No active deliveries' : 'No deliveries yet'}
          subtitle={filter === 'active' ? 'You have no deliveries assigned right now.' : 'Your delivery history is empty.'}
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
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/(driver)/deliveries/${item.id}`)}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNum}>{item.order?.order_number ?? `DEL-${item.id}`}</Text>
                    {customer && (
                      <Text style={styles.customerName}>{customer.first_name} {customer.last_name}</Text>
                    )}
                  </View>
                  <StatusBadge status={item.status} type="delivery" />
                </View>
                <View style={styles.addressRow}>
                  <Text style={{ fontSize: 14 }}>📍</Text>
                  <Text style={styles.address} numberOfLines={2}>
                    {item.order?.delivery_address}, {item.order?.delivery_city}, {item.order?.delivery_state}
                  </Text>
                </View>
                <View style={styles.cardBottom}>
                  {customer?.phone ? (
                    <Text style={styles.phone}>📞 {customer.phone}</Text>
                  ) : (
                    <Text />
                  )}
                  <Text style={styles.date}>{formatDate(item.dispatched_at ?? item.delivered_at ?? '')}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.ink },
  count:   { fontSize: 13, color: Colors.ink3 },
  tabs:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab:         { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg },
  tabActive:   { backgroundColor: Colors.brand },
  tabText:     { fontSize: 13, fontWeight: '600', color: Colors.ink3 },
  tabTextActive:{ color: Colors.white },
  skeletons: { padding: 16, gap: 4 },
  list:      { padding: 16, gap: 12 },
  card:      { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  orderNum:     { fontSize: 15, fontWeight: '800', color: Colors.ink },
  customerName: { fontSize: 13, color: Colors.ink3, marginTop: 2 },
  addressRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  address:      { flex: 1, fontSize: 13, color: Colors.ink2, lineHeight: 19 },
  cardBottom:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phone:        { fontSize: 13, color: Colors.teal },
  date:         { fontSize: 12, color: Colors.ink4 },
});
