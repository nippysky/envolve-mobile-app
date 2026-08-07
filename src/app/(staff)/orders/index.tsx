import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';
import { Icon } from '@/components/ui/Icon';
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
  customer: { first_name: string; last_name: string; email: string } | null;
}

interface OrdersResponse {
  records:    Order[];
  pagination: { total: number };
}

const STATUS_FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'PENDING',     label: 'Pending' },
  { value: 'CONFIRMED',   label: 'Confirmed' },
  { value: 'PROCESSING',  label: 'Processing' },
  { value: 'DISPATCHED',  label: 'Dispatched' },
  { value: 'DELIVERED',   label: 'Delivered' },
  { value: 'CANCELLED',   label: 'Cancelled' },
];

export default function StaffOrders() {
  const insets   = useSafeAreaInsets();
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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

  const orders  = data?.records ?? [];
  const activeFilter = STATUS_FILTERS.find(f => f.value === filter);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>All Orders</Text>
          {!isLoading && (
            <Text style={styles.count}>{data?.pagination?.total ?? 0} orders</Text>
          )}
        </View>
      </View>

      {/* Search + Filter row */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={Colors.ink4} />
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
              <Icon name="close" size={14} color={Colors.ink4} />
            </Pressable>
          )}
        </View>

        {/* Filter button */}
        <Pressable
          style={[styles.filterBtn, filter !== 'all' && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <Icon name="filter" size={16} color={filter !== 'all' ? Colors.brand : Colors.ink3} />
          {filter !== 'all' && (
            <Text style={styles.filterBtnLabel}>{activeFilter?.label}</Text>
          )}
        </Pressable>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
        </View>
      ) : isError ? (
        <EmptyState
          iconName="alert"
          title="Couldn't load orders"
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : orders.length === 0 ? (
        <EmptyState
          iconName="orders"
          title="No orders found"
          subtitle={debSearch || filter !== 'all' ? 'Try adjusting your search or filter.' : 'Orders will appear here once placed.'}
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
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/(staff)/orders/${item.id}`)}
            >
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
              <View style={styles.divider} />
              <View style={styles.cardBottom}>
                <View style={styles.meta}>
                  <Icon name="clock" size={12} color={Colors.ink4} />
                  <Text style={styles.metaText}>
                    {formatDate(item.created_at)} · {item.item_count} item{item.item_count !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.bottomRight}>
                  <StatusBadge status={item.payment_status} type="payment" />
                  <Text style={styles.amount}>{formatNaira(item.total)}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Filter modal */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilter(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Filter by status</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {STATUS_FILTERS.map(f => (
              <Pressable
                key={f.value}
                style={[styles.modalOption, filter === f.value && styles.modalOptionActive]}
                onPress={() => { setFilter(f.value); setShowFilter(false); }}
              >
                <Text style={[styles.modalOptionText, filter === f.value && styles.modalOptionTextActive]}>
                  {f.label}
                </Text>
                {filter === f.value && <Icon name="check" size={16} color={Colors.brand} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  {
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  heading: { ...type.h2, color: Colors.ink },
  count:   { ...type.caption, color: Colors.ink4, marginTop: 2 },

  toolbar: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  searchBox: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.bg,
    borderRadius:      12,
    paddingHorizontal: 12,
    height:            42,
    gap:               8,
    borderWidth:       1,
    borderColor:       Colors.line,
  },
  searchInput: {
    flex:     1,
    ...type.body,
    color:    Colors.ink,
  },
  filterBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    paddingHorizontal: 14,
    height:          42,
    borderRadius:    12,
    backgroundColor: Colors.bg,
    borderWidth:     1,
    borderColor:     Colors.line,
  },
  filterBtnActive: {
    backgroundColor: Colors.brandLight,
    borderColor:     Colors.brand,
  },
  filterBtnLabel: {
    ...type.btnSm,
    color: Colors.brand,
  },

  skeletons: { padding: 16, gap: 8 },
  list:      { padding: 16, gap: 10, paddingBottom: 32 },

  card: {
    backgroundColor: Colors.white,
    borderRadius:    16,
    padding:         16,
    shadowColor:     '#000',
    shadowOpacity:   0.04,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       1,
  },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  orderNum:     { ...type.h4, color: Colors.ink },
  customerName: { ...type.caption, color: Colors.ink3, marginTop: 3 },
  divider:      { height: 0.5, backgroundColor: Colors.line, marginVertical: 10 },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:     { ...type.caption, color: Colors.ink4 },
  bottomRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount:       { ...type.h4, color: Colors.ink },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor:   Colors.white,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop:        16,
    maxHeight:         '60%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.line,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle:           { ...type.h3, color: Colors.ink, marginBottom: 12 },
  modalOption:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.line },
  modalOptionActive:    { },
  modalOptionText:      { ...type.bodyMed, color: Colors.ink2 },
  modalOptionTextActive:{ ...type.bodyMed, color: Colors.brand },
});
