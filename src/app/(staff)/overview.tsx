import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNaira } from '@/lib/format';
import { api } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface Kpis {
  revenue:           number;
  revenueTrend:      number | null;
  orders:            number;
  ordersTrend:       number | null;
  avgOrderValue:     number;
  activeShipments:   number;
  newCustomers:      number;
  newCustomersTrend: number | null;
}

interface SummaryResponse {
  period: number;
  kpis:   Kpis;
}

export default function Overview() {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['staff-stats'],
    queryFn:  () => api.get<SummaryResponse>('/api/reports/summary'),
    refetchInterval: 60_000,
  });

  const kpis = data?.kpis;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Good day, {user?.first_name} 👋</Text>
          <Text style={styles.role}>{user?.role?.replace('_', ' ')}</Text>
        </View>
        <View style={styles.topBarIcon}>
          <Icon name="overview" size={20} color={Colors.brand} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.brand}
          />
        }
      >
        {/* KPI section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Last 30 days</Text>
        </View>

        {isLoading ? (
          <View style={styles.statsGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={108} radius={18} style={{ flex: 1, minWidth: '45%' }} />
            ))}
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              iconName="money"
              label="Revenue"
              value={formatNaira(kpis?.revenue ?? 0)}
              trend={kpis?.revenueTrend}
              accentColor={Colors.success}
            />
            <StatCard
              iconName="orders"
              label="Orders"
              value={String(kpis?.orders ?? 0)}
              trend={kpis?.ordersTrend}
              accentColor={Colors.brand}
            />
            <StatCard
              iconName="chart"
              label="Avg Order"
              value={formatNaira(kpis?.avgOrderValue ?? 0)}
              accentColor={Colors.teal}
            />
            <StatCard
              iconName="customers"
              label="New Customers"
              value={String(kpis?.newCustomers ?? 0)}
              trend={kpis?.newCustomersTrend}
              accentColor={Colors.info}
            />
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>

        <View style={styles.actionsGrid}>
          <ActionCard
            iconName="orders"
            label="Orders"
            color={Colors.brand}
            onPress={() => router.push('/(staff)/orders')}
          />
          <ActionCard
            iconName="customers"
            label="Customers"
            color={Colors.teal}
            onPress={() => router.push('/(staff)/customers')}
          />
          <ActionCard
            iconName="product"
            label="Add Product"
            color={Colors.warning}
            onPress={() => router.push('/(staff)/products/new')}
          />
          {isAdmin && (
            <ActionCard
              iconName="team"
              label="Team"
              color={Colors.info}
              onPress={() => router.push('/(staff)/team')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  iconName,
  label,
  value,
  trend,
  accentColor,
}: {
  iconName:    IconName;
  label:       string;
  value:       string;
  trend?:      number | null;
  accentColor: string;
}) {
  return (
    <View style={[stat.wrap, { borderTopColor: accentColor, borderTopWidth: 3 }]}>
      <View style={[stat.iconWrap, { backgroundColor: accentColor + '15' }]}>
        <Icon name={iconName} size={18} color={accentColor} />
      </View>
      <Text style={stat.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={stat.label}>{label}</Text>
      {trend !== undefined && trend !== null && (
        <View style={stat.trendRow}>
          <Icon
            name={trend >= 0 ? 'chart' : 'chevron-down'}
            size={10}
            color={trend >= 0 ? Colors.success : Colors.danger}
          />
          <Text style={[stat.trend, { color: trend >= 0 ? Colors.success : Colors.danger }]}>
            {Math.abs(trend)}% vs last period
          </Text>
        </View>
      )}
    </View>
  );
}

function ActionCard({
  iconName,
  label,
  color,
  onPress,
}: {
  iconName: IconName;
  label:    string;
  color:    string;
  onPress:  () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [action.wrap, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      <View style={[action.iconWrap, { backgroundColor: color + '15' }]}>
        <Icon name={iconName} size={24} color={color} />
      </View>
      <Text style={action.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  topBar:  {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   16,
    backgroundColor:   Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  topBarIcon: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: Colors.brandLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  greeting:     { ...type.h2, color: Colors.ink },
  role:         { ...type.overline, color: Colors.ink4, marginTop: 2 },
  content:      { padding: 16, gap: 4 },
  sectionHeader:{ paddingVertical: 10 },
  sectionTitle: { ...type.h4, color: Colors.ink },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  actionsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});

const stat = StyleSheet.create({
  wrap: {
    flex:             1,
    minWidth:         '45%',
    backgroundColor:  Colors.white,
    borderRadius:     18,
    padding:          16,
    shadowColor:      '#000',
    shadowOpacity:    0.05,
    shadowRadius:     10,
    shadowOffset:     { width: 0, height: 2 },
    elevation:        2,
    gap:              4,
  },
  iconWrap: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   6,
  },
  value:   { ...type.h2, color: Colors.ink },
  label:   { ...type.caption, color: Colors.ink3 },
  trendRow:{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  trend:   { ...type.caption, fontWeight: '600' },
});

const action = StyleSheet.create({
  wrap: {
    flex:           1,
    minWidth:       '44%',
    backgroundColor: Colors.white,
    borderRadius:   18,
    padding:        18,
    alignItems:     'center',
    gap:            10,
    shadowColor:    '#000',
    shadowOpacity:  0.05,
    shadowRadius:   10,
    shadowOffset:   { width: 0, height: 2 },
    elevation:      2,
  },
  iconWrap: {
    width:          52,
    height:         52,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  label: { ...type.label, color: Colors.ink, textAlign: 'center' },
});
