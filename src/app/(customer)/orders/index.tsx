import React from 'react';
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
import { formatNaira, formatDate } from '@/lib/format';
import { api } from '@/lib/api-client';

interface Order {
  id:             number;
  order_number:   string;
  status:         string;
  payment_status: string;
  total:          number;
  created_at:     string;
  preview_items:  Array<{ brand_name: string; quantity: number }>;
}

interface OrdersResponse {
  records:    Order[];
  pagination: { total: number };
}

export default function Orders() {
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['customer-orders'],
    queryFn:  () => api.get<OrdersResponse>('/api/orders/my'),
  });

  const orders = data?.records ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Orders</Text>
        {!isLoading && <Text style={styles.count}>{data?.pagination?.total ?? 0} total</Text>}
      </View>

      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
        </View>
      ) : isError ? (
        <EmptyState icon="⚠️" title="Couldn't load orders" actionLabel="Retry" onAction={() => refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No orders yet"
          subtitle="Your orders will appear here after you shop."
          actionLabel="Shop now"
          onAction={() => router.push('/(customer)/catalog')}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/(customer)/orders/${item.id}`)}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.orderNum}>{item.order_number}</Text>
                  <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
                </View>
                <StatusBadge status={item.status} type="order" />
              </View>
              {item.preview_items?.length > 0 && (
                <Text style={styles.preview} numberOfLines={1}>
                  {item.preview_items.map(p => `${p.brand_name} ×${p.quantity}`).join(' · ')}
                </Text>
              )}
              <View style={styles.cardBottom}>
                <StatusBadge status={item.payment_status} type="payment" />
                <Text style={styles.amount}>{formatNaira(item.total)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  heading:   { fontSize: 20, fontWeight: '800', color: Colors.ink },
  count:     { fontSize: 13, color: Colors.ink3 },
  skeletons: { padding: 20, gap: 4 },
  list:      { padding: 16, gap: 12 },
  card:      { backgroundColor: Colors.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 10 },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  orderNum:  { fontSize: 15, fontWeight: '800', color: Colors.ink },
  orderDate: { fontSize: 12, color: Colors.ink4, marginTop: 2 },
  preview:   { fontSize: 13, color: Colors.ink3 },
  cardBottom:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount:    { fontSize: 17, fontWeight: '800', color: Colors.ink },
});
