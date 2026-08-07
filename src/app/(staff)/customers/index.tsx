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
import { formatDate } from '@/lib/format';
import { api } from '@/lib/api-client';

const CUSTOMER_STATUSES = ['all', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PCN_CERT_UPLOADED', 'OTP_CONFIRMED', 'REGISTERED'];

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

export default function Customers() {
  const insets = useSafeAreaInsets();
  const [search, setSearch]       = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [filter, setFilter]       = useState('all');

  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  function handleSearch(t: string) {
    setSearch(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebSearch(t), 400);
  }

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['staff-customers', debSearch, filter],
    queryFn:  () => {
      const params = new URLSearchParams();
      if (debSearch)        params.set('search', debSearch);
      if (filter !== 'all') params.set('status', filter);
      const qs = params.toString();
      return api.get<CustomersResponse>(`/api/customers${qs ? `?${qs}` : ''}`);
    },
  });

  const customers = data?.records ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Customers</Text>
        {!isLoading && <Text style={styles.count}>{data?.pagination?.total ?? 0}</Text>}
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 15 }}>🔍</Text>
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
              <Text style={{ fontSize: 13, color: Colors.ink4 }}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={CUSTOMER_STATUSES}
        keyExtractor={s => s}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, filter === item && styles.chipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>
              {item === 'all' ? 'All' : item.replace(/_/g, ' ')}
            </Text>
          </Pressable>
        )}
      />

      {isLoading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
        </View>
      ) : isError ? (
        <EmptyState icon="⚠️" title="Couldn't load customers" actionLabel="Retry" onAction={() => refetch()} />
      ) : customers.length === 0 ? (
        <EmptyState icon="👥" title="No customers found" subtitle={debSearch ? 'Try a different search.' : 'Customers will appear here once they sign up.'} />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/(staff)/customers/${item.id}`)}>
              <View style={styles.cardTop}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>
                    {item.user.first_name?.[0]?.toUpperCase()}{item.user.last_name?.[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.user.first_name} {item.user.last_name}</Text>
                  <Text style={styles.email} numberOfLines={1}>{item.user.email}</Text>
                  {item.company_name && <Text style={styles.company} numberOfLines={1}>{item.company_name}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StatusBadge status={item.status} type="order" />
                  {item.pcn_verified && <Text style={styles.pcnBadge}>✓ PCN</Text>}
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.location}>{[item.city, item.state].filter(Boolean).join(', ') || '—'}</Text>
                <Text style={styles.date}>Joined {formatDate(item.created_at)}</Text>
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
  searchWrap: { padding: 12, paddingBottom: 8, backgroundColor: Colors.white },
  searchBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 10, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput:{ flex: 1, fontSize: 14, color: Colors.ink },
  chips:      { paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bg },
  chipActive: { backgroundColor: Colors.brand },
  chipText:   { fontSize: 11, fontWeight: '600', color: Colors.ink3 },
  chipTextActive:{ color: Colors.white },
  skeletons:  { padding: 16, gap: 4 },
  list:       { padding: 16, gap: 10 },
  card:       { backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.brand + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 16, fontWeight: '800', color: Colors.brand },
  name:       { fontSize: 15, fontWeight: '700', color: Colors.ink },
  email:      { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  company:    { fontSize: 12, color: Colors.ink4, marginTop: 1, fontStyle: 'italic' },
  pcnBadge:   { fontSize: 10, fontWeight: '700', color: Colors.success, backgroundColor: Colors.success + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  location:   { fontSize: 12, color: Colors.ink4 },
  date:       { fontSize: 12, color: Colors.ink4 },
});
