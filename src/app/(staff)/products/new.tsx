/**
 * Add a product. ADMIN only.
 *
 * The SKU isn't asked for — the API derives it from the manufacturer and brand
 * name and guarantees uniqueness. Letting someone type one invites collisions
 * and inconsistent formats across a catalogue that's meant to be machine-
 * sortable.
 *
 * Defaults to DRAFT. A product needs a price, an image and usually a stock
 * receipt before it should be sellable, and none of those happen in one form
 * on a phone. Activating is a deliberate second step on the detail screen —
 * which is also where the API's zero-price guard is explained.
 *
 * Images aren't uploaded here. `POST /api/products/:sku/images` needs the SKU,
 * which doesn't exist until this succeeds, so the flow is create → open → add
 * images.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { listCategories, listManufacturers } from '@/lib/services/admin.service';
import { apiFetch, ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function AddProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';

  const [brand,    setBrand]    = useState('');
  const [generic,  setGeneric]  = useState('');
  const [strength, setStrength] = useState('');
  const [packSize, setPackSize] = useState('');
  const [perCarton, setPerCarton] = useState('');

  const [categoryId,     setCategoryId]     = useState<number | null>(null);
  const [manufacturerId, setManufacturerId] = useState<number | null>(null);

  const [price,    setPrice]    = useState('');
  const [minOrder, setMinOrder] = useState('1');
  const [minStock, setMinStock] = useState('0');
  const [reorder,  setReorder]  = useState('0');
  const [shelf,    setShelf]    = useState('');

  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const clear = (k: string) => setErrs(p => ({ ...p, [k]: '' }));

  const categoriesQ = useQuery({
    queryKey: ['products', 'categories'],
    queryFn:  listCategories,
    enabled:  isAdmin,
    staleTime: 5 * 60_000,
  });

  const manufacturersQ = useQuery({
    queryKey: ['products', 'manufacturers'],
    queryFn:  listManufacturers,
    enabled:  isAdmin,
    staleTime: 5 * 60_000,
  });

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (brand.trim().length   < 1) e.brand   = 'Brand name is required.';
    if (generic.trim().length < 1) e.generic = 'Generic name is required.';

    // The API requires a positive selling_price on create, so an empty or zero
    // price fails server-side — catch it here with a useful message.
    const p = parseFloat(price);
    if (!price.trim())                  e.price = 'A selling price is required.';
    else if (!Number.isFinite(p) || p <= 0) e.price = 'Enter a price greater than zero.';

    const mo = parseInt(minOrder, 10);
    if (!Number.isFinite(mo) || mo < 1) e.minOrder = 'Minimum order must be at least 1.';

    setErrs(e);
    return Object.keys(e).length === 0;
  }, [brand, generic, price, minOrder]);

  const submit = useCallback(async () => {
    if (busy || !validate()) return;

    setBusy(true);
    try {
      const res = await apiFetch<{ product: { sku: string } }>('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          brand_name:          brand.trim(),
          generic_name:        generic.trim(),
          product_strength:    strength.trim() || undefined,
          pack_size:           packSize.trim() || undefined,
          quantity_per_carton: perCarton ? parseInt(perCarton, 10) : undefined,
          category_id:         categoryId ?? undefined,
          manufacturer_id:     manufacturerId ?? undefined,
          selling_price:       parseFloat(price),
          minimum_order:       parseInt(minOrder, 10),
          minimum_stock_level: parseInt(minStock, 10) || 0,
          reorder_quantity:    parseInt(reorder, 10) || 0,
          shelf_location:      shelf.trim() || undefined,
          // Deliberate: a new product isn't sellable until it has images and
          // stock, both of which happen after this form.
          status: 'DRAFT',
        }),
      });

      await queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${brand.trim()} created as a draft.`, 'Product added');

      // Straight to the detail screen — that's where images and activation live.
      if (res?.product?.sku) {
        router.replace(`/(staff)/products/${encodeURIComponent(res.product.sku)}` as never);
      } else {
        router.back();
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.errors) {
        setErrs({
          brand:    e.errors.brand_name?.[0] ?? '',
          generic:  e.errors.generic_name?.[0] ?? '',
          price:    e.errors.selling_price?.[0] ?? '',
          minOrder: e.errors.minimum_order?.[0] ?? '',
        });
        toast.error('Check the highlighted fields.', 'Couldn’t add product');
      } else {
        toast.error(e.message, 'Couldn’t add product');
      }
      setBusy(false);
    }
  }, [busy, validate, brand, generic, strength, packSize, perCarton,
      categoryId, manufacturerId, price, minOrder, minStock, reorder, shelf,
      queryClient, router]);

  const previewPrice = useMemo(() => {
    const p = parseFloat(price);
    return Number.isFinite(p) && p > 0 ? formatNaira(p) : null;
  }, [price]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader variant="compact" back title="Add product" />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: gutter, gap: space.md }}>
            <Icon name="lock" size={30} color={color.textDisabled} />
            <Text variant="title3" align="center">Admins only</Text>
            <Text variant="callout" tone="tertiary" align="center">
              Products are managed by administrators. You have read access to the
              catalogue.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Add product"
          subtitle="Saved as a draft"
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 56}
        >
          <ScrollView
            contentContainerStyle={{ padding: gutter, gap: space.xl, paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(320)}>
              <Surface tone="subtle" level="none" padded="base" rounded="lg">
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Icon name="info" size={16} color={color.accent} filled />
                  <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                    The SKU is generated for you from the manufacturer and brand
                    name. Add images and stock on the next screen, then activate it.
                  </Text>
                </View>
              </Surface>
            </Animated.View>

            {/* ── Identity ── */}
            <Group index={0} title="Identity">
              <Input
                label="Brand name"
                placeholder="e.g. Panadol Extra"
                value={brand}
                onChangeText={v => { setBrand(v); clear('brand'); }}
                error={errs.brand}
                autoCapitalize="words"
                editable={!busy}
                required
              />
              <Input
                label="Generic name"
                placeholder="e.g. Paracetamol + Caffeine"
                value={generic}
                onChangeText={v => { setGeneric(v); clear('generic'); }}
                error={errs.generic}
                autoCapitalize="words"
                editable={!busy}
                required
              />
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Input
                  label="Strength"
                  placeholder="500mg"
                  value={strength}
                  onChangeText={setStrength}
                  editable={!busy}
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Pack size"
                  placeholder="24 tablets"
                  value={packSize}
                  onChangeText={setPackSize}
                  editable={!busy}
                  containerStyle={{ flex: 1 }}
                />
              </View>
            </Group>

            {/* ── Classification ── */}
            <Group index={1} title="Classification">
              <Picker
                label="Category"
                options={(categoriesQ.data?.categories ?? []).map(c => ({ id: c.id, name: c.name }))}
                selected={categoryId}
                onSelect={setCategoryId}
                loading={categoriesQ.isLoading}
                disabled={busy}
                emptyHint="No categories yet — add them from the web console."
              />
              <Picker
                label="Manufacturer"
                options={(manufacturersQ.data?.manufacturers ?? []).map(m => ({ id: m.id, name: m.name }))}
                selected={manufacturerId}
                onSelect={setManufacturerId}
                loading={manufacturersQ.isLoading}
                disabled={busy}
                emptyHint="No manufacturers yet — add them from the web console."
              />
            </Group>

            {/* ── Commercial ── */}
            <Group index={2} title="Pricing & stock">
              <Input
                label="Selling price"
                hint="Per pack. Required — a product with no price can’t be activated."
                placeholder="0"
                value={price}
                onChangeText={v => { setPrice(v); clear('price'); }}
                error={errs.price}
                keyboardType="decimal-pad"
                editable={!busy}
                required
                leading={<Text variant="callout" tone="tertiary">₦</Text>}
              />

              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Input
                  label="Minimum order"
                  hint="Packs"
                  value={minOrder}
                  onChangeText={v => { setMinOrder(v); clear('minOrder'); }}
                  error={errs.minOrder}
                  keyboardType="number-pad"
                  editable={!busy}
                  required
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Per carton"
                  hint="Optional"
                  value={perCarton}
                  onChangeText={setPerCarton}
                  keyboardType="number-pad"
                  editable={!busy}
                  containerStyle={{ flex: 1 }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Input
                  label="Reorder level"
                  hint="Flags as low"
                  value={minStock}
                  onChangeText={setMinStock}
                  keyboardType="number-pad"
                  editable={!busy}
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Reorder qty"
                  hint="Suggested"
                  value={reorder}
                  onChangeText={setReorder}
                  keyboardType="number-pad"
                  editable={!busy}
                  containerStyle={{ flex: 1 }}
                />
              </View>

              <Input
                label="Shelf location"
                placeholder="e.g. A3-04"
                value={shelf}
                onChangeText={setShelf}
                autoCapitalize="characters"
                editable={!busy}
              />
            </Group>

            {/* ── Preview ── */}
            {brand.trim() ? (
              <Animated.View entering={FadeIn.duration(240)} style={{ gap: space.sm }}>
                <Text variant="overline" tone="tertiary">Preview</Text>
                <Surface level="sm" padded="base" rounded="lg">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <View style={{
                      width: 46, height: 46, borderRadius: radius.md,
                      backgroundColor: color.surfaceSubtle,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="product" size={18} color={color.textDisabled} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>{brand.trim()}</Text>
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        {[generic.trim(), strength.trim(), packSize.trim()]
                          .filter(Boolean).join(' · ') || 'No details yet'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 2 }}>
                        <Badge tone="warning" size="sm" dot>draft</Badge>
                      </View>
                    </View>
                    <Text variant="bodyMedium" tone={previewPrice ? 'default' : 'disabled'}>
                      {previewPrice ?? '—'}
                    </Text>
                  </View>
                </Surface>
              </Animated.View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            paddingHorizontal: gutter,
            paddingTop: space.base,
            paddingBottom: Math.max(insets.bottom, space.base),
            backgroundColor: color.surface,
            borderTopWidth: layout.hairlineWidth,
            borderTopColor: color.border,
          }}
        >
          <Button
            size="lg"
            fullWidth
            loading={busy}
            disabled={busy}
            onPress={submit}
            haptic="medium"
          >
            {busy ? 'Creating…' : 'Create draft product'}
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function Group({ index, title, children }: {
  index: number; title: string; children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 60).duration(320)} style={{ gap: space.md }}>
      <Text variant="overline" tone="tertiary">{title}</Text>
      <View style={{ gap: space.md }}>{children}</View>
    </Animated.View>
  );
}

/**
 * Horizontal chip picker. Better than a modal dropdown for lists of this size —
 * the options stay visible while the rest of the form is filled in, and one tap
 * selects rather than three (open, scroll, pick).
 */
function Picker({
  label, options, selected, onSelect, loading, disabled, emptyHint,
}: {
  label: string;
  options: { id: number; name: string }[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  loading: boolean;
  disabled: boolean;
  emptyHint: string;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="secondary">{label}</Text>

      {loading ? (
        <Text variant="caption" tone="disabled">Loading…</Text>
      ) : options.length === 0 ? (
        <Text variant="caption" tone="disabled">{emptyHint}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: space.sm }}
        >
          {options.map(o => {
            const active = selected === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => onSelect(active ? null : o.id)}
                disabled={disabled}
                haptic="light"
                pressScale={0.95}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  paddingHorizontal: space.base, height: 34,
                  justifyContent: 'center', borderRadius: radius.full,
                  backgroundColor: active ? color.brandSoft : color.surface,
                  borderWidth: active ? 1.5 : layout.hairlineWidth,
                  borderColor: active ? color.brand : color.border,
                }}
              >
                <Text variant="caption" style={{
                  color: active ? color.brand : color.textSecondary,
                  fontWeight: active ? '700' : '500',
                }}>
                  {o.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
