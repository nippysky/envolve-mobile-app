import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/format';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

// GET /api/customers/:id returns the customer object directly in `data`
interface CustomerDetail {
  id:                  number;
  status:              string;
  company_name:        string | null;
  address:             string | null;
  city:                string | null;
  state:               string | null;
  pcn_certificate_url: string | null;
  pcn_verified:        boolean;
  review_note:         string | null;
  reviewed_at:         string | null;
  created_at:          string;
  order_count:         number;
  user: {
    first_name: string;
    last_name:  string;
    email:      string;
    phone:      string | null;
  };
  reviewed_by: { name: string; email: string } | null;
}

export default function CustomerDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const qc      = useQueryClient();

  const [rejectNote, setRejectNote]           = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // api-client unwraps .data — the customer IS the data, no { customer } wrapper
  const { data: customer, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['staff-customer', id],
    queryFn:  () => api.get<CustomerDetail>(`/api/customers/${id}`),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { decision: 'approve' | 'reject'; review_note?: string }) =>
      api.patch(`/api/customers/${id}/review`, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['staff-customer', id] });
      qc.invalidateQueries({ queryKey: ['staff-customers'] });
      setShowRejectInput(false);
      setRejectNote('');
      toast.success(
        vars.decision === 'approve'
          ? 'Customer approved and notified by email.'
          : 'Customer rejected and notified by email.',
        vars.decision === 'approve' ? 'Approved ✅' : 'Rejected',
      );
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Action failed. Please try again.');
    },
  });

  function handleApprove() {
    Alert.alert(
      'Approve Customer',
      `Approve ${customer?.user?.first_name} ${customer?.user?.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => reviewMutation.mutate({ decision: 'approve' }) },
      ],
    );
  }

  function handleReject() {
    if (!rejectNote.trim()) {
      toast.error('Please enter a reason for rejection.');
      return;
    }
    Alert.alert(
      'Reject Customer',
      'The customer will be notified with your reason.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => reviewMutation.mutate({ decision: 'reject', review_note: rejectNote.trim() }) },
      ],
    );
  }

  async function viewPcnCert() {
    try {
      const res = await api.get<{ signedUrl: string }>(`/api/customers/${id}/pcn-url`);
      const url = (res as any).signedUrl ?? res;
      if (typeof url === 'string') await Linking.openURL(url);
    } catch {
      toast.error('Could not load PCN certificate.');
    }
  }

  const canApprove = customer?.status !== 'APPROVED';
  const canReview  = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(customer?.status ?? '');

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        title={customer ? `${customer.user.first_name} ${customer.user.last_name}` : 'Customer'}
        back
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.brand} />}
      >
        {isLoading ? (
          <View style={{ gap: 16 }}>
            <Skeleton height={200} radius={16} />
            <Skeleton height={120} radius={16} />
            <Skeleton height={80} radius={16} />
          </View>
        ) : customer ? (
          <>
            {customer.status === 'PENDING_REVIEW' && (
              <View style={styles.pendingBanner}>
                <Text style={{ fontSize: 20 }}>⏳</Text>
                <Text style={styles.pendingText}>Awaiting review</Text>
              </View>
            )}

            {/* Profile */}
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {customer.user.first_name?.[0]?.toUpperCase()}{customer.user.last_name?.[0]?.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.fullName}>{customer.user.first_name} {customer.user.last_name}</Text>
              <Text style={styles.emailTxt}>{customer.user.email}</Text>
              {customer.user.phone && <Text style={styles.phoneTxt}>{customer.user.phone}</Text>}
              <View style={styles.statusRow}>
                <StatusBadge status={customer.status} type="order" />
                {customer.pcn_verified && (
                  <View style={styles.pcnPill}><Text style={styles.pcnText}>✓ PCN Verified</Text></View>
                )}
              </View>
            </View>

            {/* Business info */}
            <View style={styles.card}>
              <InfoRow label="Company"   value={customer.company_name ?? '—'} />
              <InfoRow label="Address"   value={customer.address ?? '—'} />
              <InfoRow label="City"      value={customer.city ?? '—'} />
              <InfoRow label="State"     value={customer.state ?? '—'} />
              <InfoRow label="Joined"    value={formatDate(customer.created_at)} />
              <InfoRow label="Orders"    value={String(customer.order_count ?? 0)} last />
            </View>

            {/* PCN cert */}
            {customer.pcn_certificate_url && (
              <Pressable style={styles.pcnCard} onPress={viewPcnCert}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pcnCardTitle}>📄 PCN Certificate</Text>
                  <Text style={styles.pcnCardSub}>Tap to view</Text>
                </View>
                <Text style={{ fontSize: 18 }}>→</Text>
              </Pressable>
            )}

            {/* Prior review */}
            {(customer.reviewed_by || customer.review_note) && (
              <View style={[styles.card, { padding: 14, gap: 6 }]}>
                <Text style={styles.reviewLabel}>Previous Review</Text>
                {customer.reviewed_by && <Text style={styles.reviewMeta}>By: {customer.reviewed_by.name}</Text>}
                {customer.reviewed_at && <Text style={styles.reviewMeta}>On: {formatDate(customer.reviewed_at)}</Text>}
                {customer.review_note && <Text style={styles.reviewNote}>{customer.review_note}</Text>}
              </View>
            )}

            {/* Review actions */}
            {canReview && (
              <>
                <Text style={styles.sectionTitle}>Review Decision</Text>

                {canApprove && (
                  <Button variant="primary" size="lg" fullWidth
                    loading={reviewMutation.isPending && !showRejectInput}
                    onPress={handleApprove}
                  >
                    ✅ Approve Customer
                  </Button>
                )}

                {!showRejectInput ? (
                  <Button
                    variant={customer.status === 'REJECTED' ? 'outline' : 'danger'}
                    size="lg" fullWidth
                    onPress={() => setShowRejectInput(true)}
                  >
                    ❌ {customer.status === 'REJECTED' ? 'Update Rejection' : 'Reject Customer'}
                  </Button>
                ) : (
                  <View style={styles.rejectBox}>
                    <Text style={styles.rejectLabel}>Reason for rejection *</Text>
                    <TextInput
                      style={styles.rejectInput}
                      placeholder="e.g. PCN certificate is expired or invalid"
                      placeholderTextColor={Colors.ink4}
                      value={rejectNote}
                      onChangeText={setRejectNote}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable
                        style={styles.cancelBtn}
                        onPress={() => { setShowRejectInput(false); setRejectNote(''); }}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Button variant="danger" size="md" fullWidth
                          loading={reviewMutation.isPending}
                          onPress={handleReject}
                        >
                          Confirm Rejection
                        </Button>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={{ height: 16 }} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[ir.wrap, !last && ir.border]}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 12 },

  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.warning + '15', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: Colors.warning },
  pendingText:   { fontSize: 14, fontWeight: '700', color: Colors.warning },

  profileCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatarCircle:{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.brand + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText:  { fontSize: 28, fontWeight: '800', color: Colors.brand },
  fullName:    { fontSize: 20, fontWeight: '800', color: Colors.ink },
  emailTxt:    { fontSize: 14, color: Colors.ink3 },
  phoneTxt:    { fontSize: 13, color: Colors.ink4 },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  pcnPill:     { backgroundColor: Colors.success + '15', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pcnText:     { fontSize: 12, fontWeight: '700', color: Colors.success },

  card: { backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },

  pcnCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.brand + '08', borderRadius: 14, padding: 16, gap: 12, borderWidth: 1.5, borderColor: Colors.brand + '30' },
  pcnCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.brand },
  pcnCardSub:   { fontSize: 12, color: Colors.ink3, marginTop: 2 },

  reviewLabel: { fontSize: 12, fontWeight: '700', color: Colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewMeta:  { fontSize: 13, color: Colors.ink3 },
  reviewNote:  { fontSize: 14, color: Colors.ink2, fontStyle: 'italic', marginTop: 4, lineHeight: 20 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.ink, marginTop: 4 },

  rejectBox:    { backgroundColor: Colors.white, borderRadius: 14, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  rejectLabel:  { fontSize: 14, fontWeight: '600', color: Colors.ink },
  rejectInput:  { borderWidth: 1.5, borderColor: Colors.danger + '60', borderRadius: 10, padding: 12, fontSize: 14, color: Colors.ink, minHeight: 100, backgroundColor: Colors.bg },
  cancelBtn:    { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText:{ fontSize: 14, fontWeight: '600', color: Colors.ink3 },
});

const ir = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  label:  { fontSize: 13, color: Colors.ink3, flex: 1 },
  value:  { fontSize: 14, fontWeight: '600', color: Colors.ink, maxWidth: '55%', textAlign: 'right' },
});
