/**
 * Team Management — list all STAFF and DRIVER users.
 * Admin-only (ADMIN / SUPER_ADMIN roles).
 * GET /api/staff
 */

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
import { formatDate } from '@/lib/format';
import { api } from '@/lib/api-client';

interface StaffMember {
  id:         number;
  first_name: string;
  last_name:  string;
  email:      string;
  phone:      string | null;
  role:       string;
  status:     string;
  created_at: string;
  avatar_url: string | null;
}

interface StaffResponse {
  records:    StaffMember[];
  pagination: { total: number };
}

const ROLE_FILTERS = [
  { value: 'all',    label: 'All' },
  { value: 'STAFF',  label: 'Staff' },
  { value: 'DRIVER', label: 'Drivers' },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:      Colors.teal,
  STAFF:      Colors.brand,
  DRIVER:     Colors.warning,
  SUPER_ADMIN: Colors.danger,
};

export default function TeamManagement() {
  const insets = useSafeAreaInsets();
  const [search, setSearch]       = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function handleSearch(t: string) {
    setSearch(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebSearch(t), 400);
  }

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['staff-team', debSearch, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debSearch)            params.set('search', debSearch);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      const qs = params.toString();
      return api.get<StaffResponse>(`/api/staff${qs ? `?${qs}` : ''}`);
    },
  });

  const members = data?.records ?? [];
  const activeFilter = ROLE_FILTERS.find(f => f.value === roleFilter);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Team</Text>
          {!isLoading && (
            <Text style={styles.count}>{data?.pagination?.total ?? 0} members</Text>
          )}
        </View>
        <Pressable style={styles.addBtn} onPress={() => router.push('/(staff)/team/new')}>
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
          style={[styles.filterBtn, roleFilter !== 'all' && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <Icon name="filter" size={16} color={roleFilter !== 'all' ? Colors.brand : Colors.ink3} />
          {roleFilter !== 'all' && (
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
        <EmptyState iconName="alert" title="Couldn't load team" actionLabel="Retry" onAction={() => refetch()} />
      ) : members.length === 0 ? (
        <EmptyState iconName="team" title="No team members" subtitle="Add your first staff or driver member." actionLabel="Add Member" onAction={() => router.push('/(staff)/team/new')} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={m => String(m.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />}
          renderItem={({ item }) => {
            const roleColor = ROLE_COLORS[item.role] ?? Colors.ink3;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
                    <Text style={[styles.avatarText, { color: roleColor }]}>
                      {item.first_name[0]?.toUpperCase()}{item.last_name[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
                    <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                    {item.phone && (
                      <Text style={styles.phone}>{item.phone}</Text>
                    )}
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor + '18' }]}>
                    <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                      {item.role}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.cardBottom}>
                  <View style={[styles.statusDot, { backgroundColor: item.status === 'ACTIVE' ? Colors.success : Colors.ink4 }]} />
                  <Text style={styles.statusText}>{item.status}</Text>
                  <View style={{ flex: 1 }} />
                  <View style={styles.dateRow}>
                    <Icon name="calendar" size={12} color={Colors.ink4} />
                    <Text style={styles.dateText}>Joined {formatDate(item.created_at)}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Filter modal */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilter(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Filter by role</Text>
          {ROLE_FILTERS.map(f => (
            <Pressable
              key={f.value}
              style={styles.modalOption}
              onPress={() => { setRoleFilter(f.value); setShowFilter(false); }}
            >
              <Text style={[styles.modalOptionText, roleFilter === f.value && styles.modalOptionActive]}>
                {f.label}
              </Text>
              {roleFilter === f.value && <Icon name="check" size={16} color={Colors.brand} />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.line,
  },
  heading: { ...type.h2, color: Colors.ink },
  count:   { ...type.caption, color: Colors.ink4, marginTop: 2 },
  addBtn:  { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center' },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.line,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: 12, paddingHorizontal: 12, height: 42,
    gap: 8, borderWidth: 1, borderColor: Colors.line,
  },
  searchInput:     { flex: 1, ...type.body, color: Colors.ink },
  filterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 42, borderRadius: 12, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.line },
  filterBtnActive: { backgroundColor: Colors.brandLight, borderColor: Colors.brand },
  filterBtnLabel:  { ...type.btnSm, color: Colors.brand },

  skeletons: { padding: 16, gap: 8 },
  list:      { padding: 16, gap: 10, paddingBottom: 32 },

  card:    { backgroundColor: Colors.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar:  { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:  { ...type.h4 },
  name:        { ...type.h4, color: Colors.ink },
  email:       { ...type.caption, color: Colors.ink3, marginTop: 2 },
  phone:       { ...type.caption, color: Colors.ink4, marginTop: 1 },
  roleBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  roleBadgeText: { ...type.overline, fontSize: 10 },
  divider:     { height: 0.5, backgroundColor: Colors.line, marginVertical: 10 },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { ...type.caption, color: Colors.ink4 },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText:    { ...type.caption, color: Colors.ink4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 16, maxHeight: '50%' },
  modalHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.line, alignSelf: 'center', marginBottom: 16 },
  modalTitle:       { ...type.h3, color: Colors.ink, marginBottom: 12 },
  modalOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.line },
  modalOptionText:  { ...type.bodyMed, color: Colors.ink2 },
  modalOptionActive:{ color: Colors.brand },
});
