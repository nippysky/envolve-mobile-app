import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
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
  item_count:     number;
  created_at:     string;
  customer: {
    first_name: string;
    last_name:  string;
    email:      string;
  } | null;
}

interface OrdersResponse {
  records:    Order[];
  pagination: { total: number };
}

const STATUS_FILTERS = ['all', 'PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

export default function StaffOrders() {
  const insets   = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debSearch, setDebSearch] = useState('');

  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  function handleSearch(t: string) {
    setSearch(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebSearch(t), 400);
  }

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['staff-orders', filter, debSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (debSearch)        params.set('search', debSearch);
      const qs = params.toString();
      return api.get<OrdersResponse>(`/api/orders${qs ? `?${qs}` : ''}`);
    },
    refetchInterval: 30_000,
  });

  const orders = data?.records ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>All Orders</Text>
        {!isLoading && <Text style={styles.count}>{data?.pagination?.total ?? 0}</Text>}
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 15 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search order # or email"
            placeholderTextColor={Colors.ink4}
            value={search}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => { setSearch(''); setDebSearch(''); }} hitSlop={8}>
              <Text style={{ fontSize: 13, color: Colors.ink4 }}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={STATUS_FILTERS}
        keyExtractor={s => s}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setFilter(item)}
            style={[styles.chip, filter === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>
              {item === 'all' ? 'All' : item.charAt(0) + item.slice(1).toLowerCase()}
            </Text>
          </Pressable>
        )}
      />

      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
        </View>
      ) : isError ? (
        <EmptyState icon="⚠️" title="Couldn't load orders" actionLabel="Retry" onAction={() => refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState icon="📋" title="No orders" subtitle="No orders match your filters." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/(staff)/orders/${item.id}`)}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNum}>{item.order_number}</Text>
                  {item.customer && (
                    <Text style={styles.customerName}>
                      {item.customer.first_name} {item.customer.last_name}
                    </Text>
                  )}
                </View>
                <StatusBadge status={item.status} type="order" />
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.meta}>{formatDate(item.created_at)} · {item.item_count} item{item.item_count !== 1 ? 's' : ''}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <StatusBadge status={item.payment_status} type="payment" />
                  <Text style={styles.amount}>{formatNaira(item.total)}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  heading:    { fontSize: 20, fontWeight: '800', color: Colors.ink },
  count:      { fontSize: 13, color: Colors.ink3 },
  searchWrap: { padding: 12, paddingBottom: 4, backgroundColor: Colors.white },
  searchBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 10, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput:{ flex: 1, fontSize: 14, color: Colors.ink },
  chips:      { paddingHorizontal: 12, paddingVertical: 10, gap: 8, backgroundColor: Colors.white },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bg },
  chipActive: { backgroundColor: Colors.brand },
  chipText:   { fontSize: 12, fontWeight: '600', color: Colors.ink3 },
  chipTextActive: { color: Colors.white },
  skeletons:  { padding: 16, gap: 4 },
  list:       { padding: 16, gap: 10 },
  card:       { backgroundColor: Colors.white, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, gap: 8 },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  orderNum:   { fontSize: 14, fontWeight: '800', color: Colors.ink },
  customerName:{ fontSize: 13, color: Colors.ink3, marginTop: 2 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta:       { fontSize: 12, color: Colors.ink4 },
  amount:     { fontSize: 15, fontWeight: '800', color: Colors.ink },
});
