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
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNaira } from '@/lib/format';
import { api } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface Summary {
  revenue:       number;
  revenue_trend: number | null;
  orders:        number;
  orders_trend:  number | null;
  avg_order:     number;
  new_customers: number;
}

interface SummaryResponse {
  summary: Summary;
  // there's more but we only use summary section
}

export default function Overview() {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['staff-stats'],
    queryFn:  () => api.get<SummaryResponse>('/api/reports/summary'),
    refetchInterval: 60_000,
  });

  const summary = data?.summary;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.greeting}>Good day, {user?.first_name} 👋</Text>
        <Text style={styles.role}>{user?.role?.replace('_', ' ')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />
        }
      >
        <Text style={styles.sectionTitle}>Last 30 days</Text>

        {isLoading ? (
          <View style={styles.statsGrid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={100} radius={16} style={{ flex: 1, minWidth: '45%' }} />
            ))}
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              emoji="💰"
              label="Revenue"
              value={formatNaira(summary?.revenue ?? 0)}
              trend={summary?.revenue_trend}
              color={Colors.success}
            />
            <StatCard
              emoji="📦"
              label="Orders"
              value={String(summary?.orders ?? 0)}
              trend={summary?.orders_trend}
              color={Colors.brand}
            />
            <StatCard
              emoji="🧾"
              label="Avg Order"
              value={formatNaira(summary?.avg_order ?? 0)}
              color={Colors.teal}
            />
            <StatCard
              emoji="👤"
              label="New Customers"
              value={String(summary?.new_customers ?? 0)}
              color={Colors.cyan}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionsGrid}>
          <ActionCard emoji="📋" label="Orders"    onPress={() => router.push('/(staff)/orders')} />
          <ActionCard emoji="👥" label="Customers" onPress={() => router.push('/(staff)/customers')} />
          <ActionCard emoji="➕" label="Add Product" onPress={() => router.push('/(staff)/products/new')} />
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  emoji,
  label,
  value,
  trend,
  color,
}: {
  emoji:  string;
  label:  string;
  value:  string;
  trend?: number | null;
  color:  string;
}) {
  return (
    <View style={[stat.wrap, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={stat.emoji}>{emoji}</Text>
      <Text style={stat.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={stat.label}>{label}</Text>
      {trend !== undefined && trend !== null && (
        <Text style={[stat.trend, { color: trend >= 0 ? Colors.success : Colors.danger }]}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last period
        </Text>
      )}
    </View>
  );
}

function ActionCard({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [action.wrap, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <Text style={action.emoji}>{emoji}</Text>
      <Text style={action.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.bg },
  topBar:   {
    paddingHorizontal: 20,
    paddingVertical:   16,
    backgroundColor:   Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  greeting:     { fontSize: 20, fontWeight: '800', color: Colors.ink },
  role:         { fontSize: 12, color: Colors.ink4, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  content:      { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.ink, marginTop: 4 },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});

const stat = StyleSheet.create({
  wrap:  {
    flex:            1,
    minWidth:        '45%',
    backgroundColor: Colors.white,
    borderRadius:    16,
    padding:         14,
    shadowColor:     '#000',
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },
  emoji: { fontSize: 24, marginBottom: 6 },
  value: { fontSize: 18, fontWeight: '800', color: Colors.ink },
  label: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  trend: { fontSize: 11, marginTop: 4, fontWeight: '600' },
});

const action = StyleSheet.create({
  wrap: {
    flex:            1,
    minWidth:        '28%',
    backgroundColor: Colors.white,
    borderRadius:    16,
    padding:         18,
    alignItems:      'center',
    gap:             8,
    shadowColor:     '#000',
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },
  emoji: { fontSize: 28 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.ink, textAlign: 'center' },
});
