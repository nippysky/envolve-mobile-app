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
import { formatDate } from '@/lib/format';
import { api } from '@/lib/api-client';

interface Customer {
  id:           number;
  status:       string;
  company_name: string | null;
  city:         string | null;
  state:        string | null;
  created_at:   string;
  pcn_verified: boolean;
  user: {
    first_name: string;
    last_name:  string;
    email:      string;
    phone:      string | null;
  };
}

interface CustomersResponse {
  records:    Customer[];
  pagination: { total: number };
}

const STATUS_FILTERS = [
  { value: 'all',              label: 'All' },
  { value: 'PENDING_REVIEW',   label: 'Pending Review' },
  { value: 'APPROVED',         label: 'Approved' },
  { value: 'REJECTED',         label: 'Rejected' },
  { value: 'OTP_CONFIRMED',    label: 'OTP Confirmed' },
  { value: 'REGISTERED',       label: 'Registered' },
];

export default function Customers() {
  const insets = useSafeAreaInsets();
  const [search, setSearch]       = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [filter, setFilter]       = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function handleSearch(t: string) {
    setSearch(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebSearch(t), 400);
  }

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['staff-customers', debSearch, filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debSearch)        params.set('search', debSearch);
      if (filter !== 'all') params.set('status', filter);
      const qs = params.toString();
      return api.get<CustomersResponse>(`/api/customers${qs ? `?${qs}` : ''}`);
    },
  });

  const customers  = data?.records ?? [];
  const activeFilter = STATUS_FILTERS.find(f => f.value === filter);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Customers</Text>
          {!isLoading && (
            <Text style={styles.count}>{data?.pagination?.total ?? 0} total</Text>
          )}
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push('/(staff)/customers/new')}
        >
          <Icon name="plus" size={18} color={Colors.white} />
        </Pressable>
      </View>

      {/* Search + filter */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={Colors.ink4} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email"
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
          {Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
        </View>
      ) : isError ? (
        <EmptyState
          iconName="alert"
          title="Couldn't load customers"
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : customers.length === 0 ? (
        <EmptyState
          iconName="customers"
          title="No customers found"
          subtitle={debSearch ? 'Try a different search.' : 'Customers will appear here once they sign up.'}
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/(staff)/customers/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>
                    {item.user.first_name?.[0]?.toUpperCase()}{item.user.last_name?.[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.user.first_name} {item.user.last_name}</Text>
                  <Text style={styles.email} numberOfLines={1}>{item.user.email}</Text>
                  {item.company_name && (
                    <Text style={styles.company} numberOfLines={1}>{item.company_name}</Text>
                  )}
                </View>
                <View style={styles.badges}>
                  <StatusBadge status={item.status} type="order" />
                  {item.pcn_verified && (
                    <View style={styles.pcnBadge}>
                      <Icon name="check" size={9} color={Colors.success} />
                      <Text style={styles.pcnText}>PCN</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.cardBottom}>
                <View style={styles.locationRow}>
                  {(item.city || item.state) && (
                    <Icon name="location" size={12} color={Colors.ink4} />
                  )}
                  <Text style={styles.locationText}>
                    {[item.city, item.state].filter(Boolean).join(', ') || '—'}
                  </Text>
                </View>
                <View style={styles.dateRow}>
                  <Icon name="calendar" size={12} color={Colors.ink4} />
                  <Text style={styles.dateText}>Joined {formatDate(item.created_at)}</Text>
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
                style={styles.modalOption}
                onPress={() => { setFilter(f.value); setShowFilter(false); }}
              >
                <Text style={[styles.modalOptionText, filter === f.value && styles.modalOptionActive]}>
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
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  heading: { ...type.h2, color: Colors.ink },
  count:   { ...type.caption, color: Colors.ink4, marginTop: 2 },
  addBtn:  {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: Colors.brand,
    alignItems:      'center',
    justifyContent:  'center',
  },

  toolbar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   10,
    backgroundColor:   Colors.white,
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
  searchInput:   { flex: 1, ...type.body, color: Colors.ink },
  filterBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 14,
    height:            42,
    borderRadius:      12,
    backgroundColor:   Colors.bg,
    borderWidth:       1,
    borderColor:       Colors.line,
  },
  filterBtnActive: { backgroundColor: Colors.brandLight, borderColor: Colors.brand },
  filterBtnLabel:  { ...type.btnSm, color: Colors.brand },

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
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarWrap: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: Colors.brandLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  avatarText: { ...type.h4, color: Colors.brand },
  name:       { ...type.h4, color: Colors.ink },
  email:      { ...type.caption, color: Colors.ink3, marginTop: 2 },
  company:    { ...type.caption, color: Colors.ink4, marginTop: 1, fontStyle: 'italic' },
  badges:     { alignItems: 'flex-end', gap: 5 },
  pcnBadge:   {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             3,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius:    8,
  },
  pcnText:  { ...type.overline, fontSize: 9, color: Colors.success },
  divider:  { height: 0.5, backgroundColor: Colors.line, marginVertical: 10 },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { ...type.caption, color: Colors.ink4 },
  dateRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText:     { ...type.caption, color: Colors.ink4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor:      Colors.white,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingTop:           16,
    maxHeight:            '60%',
  },
  modalHandle:          { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.line, alignSelf: 'center', marginBottom: 16 },
  modalTitle:           { ...type.h3, color: Colors.ink, marginBottom: 12 },
  modalOption:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.line },
  modalOptionText:      { ...type.bodyMed, color: Colors.ink2 },
  modalOptionActive:    { color: Colors.brand },
});
