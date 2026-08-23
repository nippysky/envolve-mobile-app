/**
 * Inventory — console.
 *
 * A batch list, not a product list. The same SKU appears once per batch,
 * because expiry and cost are batch properties and merging them would hide
 * exactly what this screen exists to surface: which specific batch is about to
 * expire, and which is running out.
 *
 * The two filters are the two reasons anyone opens this: something's low, or
 * something's expiring. Both are server-side flags the API already computes
 * (`is_low_stock`, `is_near_expiry`), so the client never re-derives a
 * threshold and drifts from the warehouse's definition.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedScrollHandler,
} from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge, EmptyState, RowSkeleton,
  Sheet, SheetOption,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { StatTile } from '@/components/admin/StatTile';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira, formatDate } from '@/lib/format';
import { useRefresh } from '@/hooks/use-refresh';
import { useDebounced } from '@/hooks/use-debounced';
import {
  listInventory, getInventoryStats, adjustStock, receiveStock, updateBatch,
  listAdminProducts, type InventoryBatch, type AdminProduct,
} from '@/lib/services/admin.service';
import { toast } from '@/lib/toast';

type Filter = 'all' | 'low' | 'expiring';

/**
 * The API takes `YYYY-MM-DD`. There's no date picker in this project, and
 * adding one for two optional fields isn't worth the native dependency, so the
 * field is typed — which means it has to be validated properly rather than
 * handed to `new Date()` and hoped for.
 */
function parseIsoDate(s: string): { ok: true; value: string } | { ok: false; reason: string } {
  const trimmed = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, reason: 'Use the format YYYY-MM-DD, e.g. 2027-03-31.' };
  }
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Catches 2027-02-31, which Date would silently roll into March.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, reason: 'That date doesn’t exist.' };
  }
  return { ok: true, value: trimmed };
}

export default function InventoryScreen() {
  const queryClient = useQueryClient();

  const [rawSearch, setRawSearch] = useState('');
  const [filter,    setFilter]    = useState<Filter>('all');
  const [adjusting, setAdjusting] = useState<number | null>(null);
  const [delta,     setDelta]     = useState('');
  const [reason,    setReason]    = useState('');
  const [busy,      setBusy]      = useState(false);

  const [receiving,    setReceiving]    = useState(false);
  const [editingBatch, setEditingBatch] = useState<InventoryBatch | null>(null);

  const search = useDebounced(rawSearch, 350);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const statsQ = useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn:  getInventoryStats,
    staleTime: 60_000,
  });

  const inventoryQ = useInfiniteQuery({
    queryKey: ['inventory', 'list', search, filter],
    queryFn:  ({ pageParam = 1 }) => listInventory({
      page: pageParam as number, limit: 20, search,
      low_stock:   filter === 'low',
      near_expiry: filter === 'expiring',
    }),
    initialPageParam: 1,
    getNextPageParam: last => {
      const { current_page, total_pages } = last.pagination;
      return current_page < total_pages ? current_page + 1 : undefined;
    },
    staleTime: 30_000,
  });

  const batches = useMemo(
    () => inventoryQ.data?.pages.flatMap(p => p.records) ?? [],
    [inventoryQ.data],
  );

  const closeAdjust = useCallback(() => {
    setAdjusting(null);
    setDelta('');
    setReason('');
  }, []);

  /**
   * Adjustment takes a signed delta, not a new total. Asking for "how many did
   * you find/lose" rather than "what's the new number" makes the reason column
   * meaningful and avoids a stocktake race where two people both set 40.
   */
  const submitAdjust = useCallback(async (batch: InventoryBatch) => {
    const n = parseInt(delta, 10);
    if (!Number.isFinite(n) || n === 0) {
      toast.error('Enter how many to add or remove, e.g. -3.', 'Amount required');
      return;
    }
    if (reason.trim().length < 3) {
      toast.error('Say why — this goes in the audit trail.', 'Reason required');
      return;
    }
    if (batch.quantity + n < 0) {
      toast.error(`Only ${batch.quantity} left in this batch.`, 'Not enough stock');
      return;
    }

    setBusy(true);
    try {
      await adjustStock({ batch_id: batch.id, quantity: n, reason: reason.trim() });
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeAdjust();
      toast.success(`${n > 0 ? '+' : ''}${n} on batch ${batch.batch_number}.`, 'Stock adjusted');
    } catch (err) {
      toast.error((err as Error).message, 'Could not adjust stock');
    } finally {
      setBusy(false);
    }
  }, [delta, reason, queryClient, closeAdjust]);

  const stats = statsQ.data;


  const { refreshing, onRefresh } = useRefresh(inventoryQ.refetch, statsQ.refetch);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Inventory"
          right={
            <Pressable
              onPress={() => setReceiving(true)}
              haptic="medium"
              pressScale={0.92}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Receive stock"
            >
              <Icon name="plus" size={20} color={color.text} />
            </Pressable>
          }
        />

        <View style={{ paddingHorizontal: gutter, gap: space.md, paddingBottom: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <StatTile
              index={0}
              icon="products"
              label="SKUs"
              value={String(stats?.total_skus ?? 0)}
              hint="In the catalogue"
              loading={statsQ.isLoading}
            />
            <StatTile
              index={1}
              icon="inventory"
              label="Packs in stock"
              value={(stats?.total_stock ?? 0).toLocaleString()}
              hint="Across all batches"
              loading={statsQ.isLoading}
            />
          </View>

          <Input
            placeholder="Search brand, generic or SKU"
            value={rawSearch}
            onChangeText={setRawSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            leading={<Icon name="search" size={17} color={color.textTertiary} />}
            trailing={rawSearch ? <Icon name="close" size={16} color={color.textTertiary} /> : undefined}
            onTrailingPress={rawSearch ? () => setRawSearch('') : undefined}
          />

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <FilterChip
              label="All batches"
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <FilterChip
              label="Low stock"
              count={stats?.low_stock_count}
              tone="warning"
              active={filter === 'low'}
              onPress={() => setFilter('low')}
            />
            <FilterChip
              label="Expiring"
              count={stats?.expiring_count}
              tone="danger"
              active={filter === 'expiring'}
              onPress={() => setFilter('expiring')}
            />
          </View>
        </View>

        <Animated.FlatList
          data={batches}
          keyExtractor={b => String(b.id)}
          // iOS insets the scroll view for the keyboard itself, which avoids the
          // KeyboardAvoidingView offset guesswork. Android is adjustResize (see
          // AndroidManifest), so the window already shrinks and this is a no-op.
          automaticallyAdjustKeyboardInsets
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingBottom: space.xl,
            gap: space.md,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (inventoryQ.hasNextPage && !inventoryQ.isFetchingNextPage) {
              void inventoryQ.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.brand}
            />
          }
          renderItem={({ item, index }) => (
            <BatchCard
              batch={item}
              index={index}
              open={adjusting === item.id}
              busy={busy}
              delta={delta}
              reason={reason}
              onToggle={() => (adjusting === item.id ? closeAdjust() : setAdjusting(item.id))}
              onDelta={setDelta}
              onReason={setReason}
              onSubmit={() => void submitAdjust(item)}
              onEdit={() => setEditingBatch(item)}
            />
          )}
          ListEmptyComponent={
            inventoryQ.isLoading ? (
              <View style={{ gap: space.md }}>
                {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : inventoryQ.isError ? (
              <EmptyState
                iconName="alert"
                tone="danger"
                title="Couldn’t load inventory"
                actionLabel="Retry"
                onAction={() => void inventoryQ.refetch()}
              />
            ) : filter !== 'all' ? (
              <EmptyState
                iconName="check-circle"
                compact
                title={filter === 'low' ? 'Nothing running low' : 'Nothing expiring soon'}
                subtitle="That's the good outcome."
                actionLabel="Show all batches"
                onAction={() => setFilter('all')}
              />
            ) : (
              <EmptyState
                iconName="inventory"
                title="No stock recorded"
                subtitle={search ? `Nothing matches “${search}”.` : 'Batches appear here once stock is received.'}
              />
            )
          }
          ListFooterComponent={inventoryQ.isFetchingNextPage ? <RowSkeleton /> : null}
        />
      </SafeAreaView>

      <ReceiveStockSheet
        visible={receiving}
        onClose={() => setReceiving(false)}
        onReceived={async () => {
          await queryClient.invalidateQueries({ queryKey: ['inventory'] });
          setReceiving(false);
        }}
      />

      <EditBatchSheet
        batch={editingBatch}
        onClose={() => setEditingBatch(null)}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ['inventory'] });
          setEditingBatch(null);
        }}
      />
    </View>
  );
}

/* ── Receive stock ──────────────────────────────────────────────────────────
   Two states in one sheet rather than a sheet inside a sheet: pick the product
   first, then fill the batch in. Nesting Modals is unreliable on Android, and
   the two steps are sequential anyway.
   ────────────────────────────────────────────────────────────────────────── */

function ReceiveStockSheet({ visible, onClose, onReceived }: {
  visible: boolean;
  onClose: () => void;
  onReceived: () => Promise<void>;
}) {
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [rawSearch, setRawSearch] = useState('');
  const search = useDebounced(rawSearch, 350);

  const [batchNo, setBatchNo] = useState('');
  const [qty,     setQty]     = useState('');
  const [cost,    setCost]    = useState('');
  const [expiry,  setExpiry]  = useState('');
  const [notes,   setNotes]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [errs,    setErrs]    = useState<Record<string, string>>({});

  const productsQ = useQuery({
    queryKey: ['products', 'console', search, null],
    queryFn:  () => listAdminProducts({ search, limit: 25 }),
    enabled:  visible && !product,
    staleTime: 60_000,
  });

  const reset = useCallback(() => {
    setProduct(null); setRawSearch('');
    setBatchNo(''); setQty(''); setCost(''); setExpiry(''); setNotes('');
    setErrs({});
  }, []);

  const close = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const submit = useCallback(async () => {
    if (!product || busy) return;

    const e: Record<string, string> = {};
    const q = parseInt(qty, 10);
    const c = parseFloat(cost);

    if (batchNo.trim().length < 1)      e.batchNo = 'Enter the batch number from the carton.';
    if (!Number.isFinite(q) || q <= 0)  e.qty     = 'Enter how many packs arrived.';
    if (!Number.isFinite(c) || c <= 0)  e.cost    = 'Enter what you paid per pack.';

    let expiryValue: string | undefined;
    if (expiry.trim()) {
      const parsed = parseIsoDate(expiry);
      if (!parsed.ok) e.expiry = parsed.reason;
      else expiryValue = parsed.value;
    }

    setErrs(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      await receiveStock({
        product_id:   product.id,
        batch_number: batchNo.trim(),
        quantity:     q,
        cost_price:   c,
        expiry_date:  expiryValue,
        notes:        notes.trim() || undefined,
      });
      toast.success(`${q} packs of ${product.brand_name} added.`, 'Stock received');
      reset();
      await onReceived();
    } catch (err) {
      const e2 = err as Error & { status?: number };
      // The batch number is unique platform-wide; 409 means it's already used.
      if (e2.status === 409) {
        setErrs({ batchNo: 'That batch number is already in use.' });
      } else {
        toast.error(e2.message, 'Could not receive stock');
      }
    } finally {
      setBusy(false);
    }
  }, [product, busy, batchNo, qty, cost, expiry, notes, reset, onReceived]);

  const records = productsQ.data?.records ?? [];

  return (
    <Sheet
      visible={visible}
      onClose={close}
      detent="tall"
      title={product ? 'Receive stock' : 'Which product?'}
      subtitle={product ? product.brand_name : 'Search the catalogue to start a new batch.'}
      footer={product ? (
        <Button
          fullWidth
          size="lg"
          loading={busy}
          disabled={busy}
          onPress={submit}
          haptic="medium"
        >
          {busy ? 'Receiving…' : 'Receive into stock'}
        </Button>
      ) : undefined}
    >
      {!product ? (
        <>
          <View style={{ paddingHorizontal: gutter, paddingVertical: space.md }}>
            <Input
              placeholder="Search brand, generic or SKU"
              value={rawSearch}
              onChangeText={setRawSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              leading={<Icon name="search" size={17} color={color.textTertiary} />}
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {productsQ.isLoading ? (
              <View style={{ gap: space.sm, paddingHorizontal: gutter }}>
                {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
              </View>
            ) : records.length === 0 ? (
              <View style={{ paddingHorizontal: gutter }}>
                <EmptyState
                  iconName="search"
                  compact
                  title="No products found"
                  subtitle={rawSearch
                    ? `Nothing matches “${rawSearch}”.`
                    : 'Start typing to search the catalogue.'}
                />
              </View>
            ) : (
              records.map((p, i) => (
                <SheetOption
                  key={p.sku}
                  icon="product"
                  // Strength and pack size are what separate two products that
                  // share a brand. Without them the picker shows what look like
                  // duplicate rows and you can receive stock against the wrong
                  // one — the same distinction the catalogue now keys identity
                  // on, so the two have to agree.
                  label={[p.brand_name, p.product_strength, p.pack_size]
                    .filter(Boolean).join(' · ')}
                  hint={[p.generic_name, p.sku].filter(Boolean).join(' · ')}
                  trailing={`${p.total_stock} in stock`}
                  last={i === records.length - 1}
                  onPress={() => setProduct(p)}
                />
              ))
            )}
          </ScrollView>
        </>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: gutter, paddingVertical: space.md, gap: space.base }}>
            <Pressable
              onPress={() => setProduct(null)}
              haptic="light"
              pressOpacity={0.6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
              <Icon name="chevron-left" size={15} color={color.brand} />
              <Text variant="label" tone="brand">Choose a different product</Text>
            </Pressable>

            <Input
              label="Batch number"
              placeholder="As printed on the carton"
              value={batchNo}
              onChangeText={t => { setBatchNo(t); setErrs(p => ({ ...p, batchNo: '' })); }}
              error={errs.batchNo}
              autoCapitalize="characters"
              editable={!busy}
              required
            />

            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Input
                label="Packs received"
                placeholder="0"
                value={qty}
                onChangeText={t => { setQty(t); setErrs(p => ({ ...p, qty: '' })); }}
                error={errs.qty}
                keyboardType="number-pad"
                editable={!busy}
                required
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Cost per pack"
                placeholder="0"
                value={cost}
                onChangeText={t => { setCost(t); setErrs(p => ({ ...p, cost: '' })); }}
                error={errs.cost}
                keyboardType="decimal-pad"
                editable={!busy}
                required
                leading={<Text variant="callout" tone="tertiary">₦</Text>}
                containerStyle={{ flex: 1 }}
              />
            </View>

            <Input
              label="Expiry date"
              placeholder="YYYY-MM-DD"
              hint="Leave blank if this stock doesn’t expire"
              value={expiry}
              onChangeText={t => { setExpiry(t); setErrs(p => ({ ...p, expiry: '' })); }}
              error={errs.expiry}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              editable={!busy}
            />

            <Input
              label="Note"
              placeholder="Optional — supplier, invoice number"
              value={notes}
              onChangeText={setNotes}
              editable={!busy}
              multiline
            />

            <Surface tone="subtle" level="none" padded="md" rounded="md">
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Icon name="info" size={14} color={color.textTertiary} />
                <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                  This creates a new batch, records the stock movement against your
                  name, and updates the product’s last cost price.
                </Text>
              </View>
            </Surface>
          </View>
        </ScrollView>
      )}
    </Sheet>
  );
}

/* ── Edit a batch ───────────────────────────────────────────────────────── */

function EditBatchSheet({ batch, onClose, onSaved }: {
  batch: InventoryBatch | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [batchNo, setBatchNo] = useState('');
  const [cost,    setCost]    = useState('');
  const [expiry,  setExpiry]  = useState('');
  const [busy,    setBusy]    = useState(false);
  const [errs,    setErrs]    = useState<Record<string, string>>({});

  // Re-seed whenever a different batch is opened. Adjusted during render, not
  // in an effect, so the sheet never paints last batch's values for a frame.
  const [seededFor, setSeededFor] = useState<number | null>(null);
  if (batch && seededFor !== batch.id) {
    setSeededFor(batch.id);
    setBatchNo(batch.batch_number);
    setCost(batch.cost_price > 0 ? String(batch.cost_price) : '');
    setExpiry(batch.expiry_date ? batch.expiry_date.slice(0, 10) : '');
    setErrs({});
  }

  const submit = useCallback(async () => {
    if (!batch || busy) return;

    const e: Record<string, string> = {};
    const c = parseFloat(cost);
    if (batchNo.trim().length < 1)     e.batchNo = 'Batch number can’t be empty.';
    if (!Number.isFinite(c) || c <= 0) e.cost    = 'Enter the cost per pack.';

    // Empty clears the expiry; the API accepts null for exactly that.
    let expiryValue: string | null = null;
    if (expiry.trim()) {
      const parsed = parseIsoDate(expiry);
      if (!parsed.ok) e.expiry = parsed.reason;
      else expiryValue = parsed.value;
    }

    setErrs(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      await updateBatch(batch.id, {
        batch_number: batchNo.trim(),
        cost_price:   c,
        expiry_date:  expiryValue,
      });
      toast.success(`Batch ${batchNo.trim()} updated.`);
      await onSaved();
    } catch (err) {
      const e2 = err as Error & { status?: number };
      if (e2.status === 409) setErrs({ batchNo: 'That batch number is already in use.' });
      else toast.error(e2.message, 'Could not save');
    } finally {
      setBusy(false);
    }
  }, [batch, busy, batchNo, cost, expiry, onSaved]);

  return (
    <Sheet
      visible={!!batch}
      onClose={onClose}
      title="Edit batch"
      subtitle={batch?.product.brand_name}
      footer={
        <Button fullWidth size="lg" loading={busy} disabled={busy} onPress={submit} haptic="medium">
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      }
    >
      <View style={{ paddingHorizontal: gutter, paddingVertical: space.md, gap: space.base }}>
        <Input
          label="Batch number"
          value={batchNo}
          onChangeText={t => { setBatchNo(t); setErrs(p => ({ ...p, batchNo: '' })); }}
          error={errs.batchNo}
          autoCapitalize="characters"
          editable={!busy}
          required
        />

        <Input
          label="Cost per pack"
          value={cost}
          onChangeText={t => { setCost(t); setErrs(p => ({ ...p, cost: '' })); }}
          error={errs.cost}
          keyboardType="decimal-pad"
          editable={!busy}
          required
          leading={<Text variant="callout" tone="tertiary">₦</Text>}
        />

        <Input
          label="Expiry date"
          placeholder="YYYY-MM-DD"
          hint="Clear this field to remove the expiry"
          value={expiry}
          onChangeText={t => { setExpiry(t); setErrs(p => ({ ...p, expiry: '' })); }}
          error={errs.expiry}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          editable={!busy}
        />

        <Surface tone="subtle" level="none" padded="md" rounded="md">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Icon name="info" size={14} color={color.textTertiary} />
            <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
              Quantity isn’t editable here — stock levels move through an
              adjustment so every change keeps its reason.
            </Text>
          </View>
        </Surface>
      </View>
    </Sheet>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function FilterChip({ label, count, tone, active, onPress }: {
  label: string; count?: number; tone?: 'warning' | 'danger';
  active: boolean; onPress: () => void;
}) {
  const activeBg = tone === 'danger' ? color.danger
    : tone === 'warning' ? color.warning
    : color.text;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        paddingHorizontal: space.sm, height: 34,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        borderRadius: radius.full,
        backgroundColor: active ? activeBg : color.surface,
        borderWidth: layout.hairlineWidth,
        borderColor: active ? activeBg : color.border,
      }}
    >
      <Text
        variant="caption"
        numberOfLines={1}
        style={{
          color: active ? '#fff' : color.textSecondary,
          fontWeight: active ? '700' : '500',
        }}
      >
        {label}
      </Text>
      {count ? (
        <Text variant="caption" style={{
          color: active ? 'rgba(255,255,255,0.75)' : color.textTertiary,
          fontWeight: '700', fontSize: 10,
        }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

function BatchCard({
  batch, index, open, busy, delta, reason,
  onToggle, onDelta, onReason, onSubmit, onEdit,
}: {
  batch: InventoryBatch;
  index: number;
  open: boolean;
  busy: boolean;
  delta: string;
  reason: string;
  onToggle: () => void;
  onDelta: (v: string) => void;
  onReason: (v: string) => void;
  onSubmit: () => void;
  onEdit: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}>
      <Surface level="sm" padded="base" rounded="lg">
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{
              width: 46, height: 46, borderRadius: radius.md,
              backgroundColor: color.surfaceSubtle,
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {batch.product.primary_image ? (
                <Image
                  source={{ uri: batch.product.primary_image }}
                  style={{ width: '76%', height: '76%' }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Icon name="product" size={18} color={color.textDisabled} />
              )}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyMedium" numberOfLines={1}>{batch.product.brand_name}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {batch.product.sku} · batch {batch.batch_number}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: 2 }}>
                {batch.is_low_stock ? <Badge tone="warning" size="sm">Low stock</Badge> : null}
                {batch.is_near_expiry ? <Badge tone="danger" size="sm">Expiring soon</Badge> : null}
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="title3">{batch.quantity}</Text>
              <Text variant="caption" tone="disabled">packs</Text>
            </View>
          </View>

          <View style={{
            flexDirection: 'row', gap: space.base, flexWrap: 'wrap',
            paddingTop: space.sm,
            borderTopWidth: layout.hairlineWidth,
            borderTopColor: color.borderSubtle,
          }}>
            <Meta label="Cost" value={formatNaira(batch.cost_price)} />
            <Meta
              label="Expires"
              value={batch.expiry_date ? formatDate(batch.expiry_date) : 'No date'}
              tone={batch.is_near_expiry ? 'danger' : undefined}
            />
            <Meta label="Min level" value={String(batch.product.minimum_stock_level)} />
          </View>

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              size="sm"
              variant={open ? 'secondary' : 'tinted'}
              style={{ flex: 1 }}
              onPress={onToggle}
              disabled={busy}
              icon={<Icon name={open ? 'close' : 'inventory'} size={14} color={open ? color.text : color.brand} />}
            >
              {open ? 'Cancel' : 'Adjust stock'}
            </Button>

            {/* Corrects the batch's own details — expiry, cost, number. Stock
                level deliberately isn't here; that's what Adjust is for. */}
            <Button
              size="sm"
              variant="secondary"
              onPress={onEdit}
              disabled={busy}
              icon={<Icon name="edit" size={14} color={color.text} />}
            >
              Details
            </Button>
          </View>

          {open ? (
            <Animated.View entering={FadeIn.duration(220)} style={{ gap: space.md }}>
              <Input
                label="Add or remove"
                hint="Signed — e.g. 12 to add, -3 to remove"
                placeholder="-3"
                value={delta}
                onChangeText={onDelta}
                keyboardType="numbers-and-punctuation"
                editable={!busy}
                required
              />
              <Input
                label="Reason"
                hint="Recorded in the audit trail against your name"
                placeholder="Damaged in transit"
                value={reason}
                onChangeText={onReason}
                editable={!busy}
                required
              />
              <Button
                fullWidth
                loading={busy}
                disabled={busy}
                onPress={onSubmit}
                haptic="medium"
              >
                Apply adjustment
              </Button>
            </Animated.View>
          ) : null}
        </View>
      </Surface>
    </Animated.View>
  );
}

function Meta({ label, value, tone }: {
  label: string; value: string; tone?: 'danger';
}) {
  return (
    <View style={{ minWidth: 84 }}>
      <Text variant="caption" tone="disabled">{label}</Text>
      <Text variant="caption" tone={tone ?? 'secondary'} numberOfLines={1}>{value}</Text>
    </View>
  );
}
