/**
 * Place an order on a customer's behalf.
 *
 * This is the screen a rep uses with the pharmacist on the phone, so it's built
 * for one-handed use under time pressure: pick who, add what, say how it was
 * paid, send. Four steps, one scroll, no wizard.
 *
 * Why the payment step looks the way it does
 * ──────────────────────────────────────────
 * Reps routinely collect money *before* the order exists — cash at the counter,
 * a POS swipe, a transfer that landed yesterday. So `payment_received` is a
 * first-class option here and requires a collection method plus a real
 * reference, which the API validates and the audit trail records against the
 * rep's name. That's the whole control: money already taken is recorded with
 * who took it and how.
 *
 * `payment_link` emails the customer a Paystack link instead — for when the
 * pharmacist wants to pay by card later.
 *
 * Address is prefilled from the customer's account but stays editable, because
 * "send this one to our second branch" is a normal request and re-typing a full
 * address on a phone while someone waits is not.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge, QuantityStepper,
  EmptyState, RowSkeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useDebounced } from '@/hooks/use-debounced';
import { listProducts, type CatalogProduct } from '@/lib/services/catalog.service';
import {
  listCustomers, createOrderOnBehalf,
  type AdminCustomer, type OnBehalfPaymentMethod,
} from '@/lib/services/admin.service';
import { toast } from '@/lib/toast';

interface Line {
  product:  CatalogProduct;
  quantity: number;
}

const METHODS: {
  value: OnBehalfPaymentMethod;
  label: string;
  hint: string;
  icon: 'money' | 'card' | 'bank' | 'truck';
}[] = [
  { value: 'payment_received',  label: 'Already collected', hint: 'Cash, POS or transfer taken before this order', icon: 'money' },
  { value: 'payment_link',      label: 'Email a payment link', hint: 'Customer pays by card via Paystack',          icon: 'card' },
  { value: 'bank_transfer',     label: 'Awaiting transfer',  hint: 'Invoice now, confirm when it lands',           icon: 'bank' },
  { value: 'cash_on_delivery',  label: 'Cash on delivery',   hint: 'Driver collects at handover',                  icon: 'truck' },
];

const RECEIVED_VIA = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Transfer' },
  { value: 'pos',           label: 'POS' },
  { value: 'other',         label: 'Other' },
] as const;

export default function OnBehalfOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [lines,    setLines]    = useState<Line[]>([]);

  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch,  setProductSearch]  = useState('');
  const [picking,        setPicking]        = useState(false);

  const [street, setStreet] = useState('');
  const [city,   setCity]   = useState('');
  const [state,  setState]  = useState('');
  const [phone,  setPhone]  = useState('');
  const [notes,  setNotes]  = useState('');
  const [po,     setPo]     = useState('');

  const [method,    setMethod]    = useState<OnBehalfPaymentMethod>('payment_received');
  const [via,       setVia]       = useState<typeof RECEIVED_VIA[number]['value']>('cash');
  const [reference, setReference] = useState('');
  const [payNote,   setPayNote]   = useState('');

  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const debouncedCustomer = useDebounced(customerSearch, 350);
  const debouncedProduct  = useDebounced(productSearch, 350);

  /* Only APPROVED customers can be ordered for — the API rejects the rest, so
     the picker never shows them rather than failing at submit. */
  const customersQ = useQuery({
    queryKey: ['customers', 'approved', debouncedCustomer],
    queryFn:  () => listCustomers({ search: debouncedCustomer, status: 'APPROVED', limit: 25 }),
    enabled:  !customer,
    staleTime: 30_000,
  });

  const productsQ = useQuery({
    queryKey: ['catalog', 'products', 'on-behalf', debouncedProduct],
    queryFn:  () => listProducts({ search: debouncedProduct, limit: 25 }),
    enabled:  picking,
    staleTime: 60_000,
  });

  // Prefill the delivery details from the account, then let the rep override.
  useEffect(() => {
    if (!customer) return;
    setStreet(customer.address ?? '');
    setCity(customer.city ?? '');
    setState(customer.state ?? '');
    setPhone(customer.user.phone ?? '');
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = useMemo(
    () => lines.reduce((s, l) => {
      const price = l.product.final_price ?? l.product.selling_price;
      return s + price * l.quantity;
    }, 0),
    [lines],
  );

  const addProduct = useCallback((product: CatalogProduct) => {
    setLines(prev => {
      const existing = prev.find(l => l.product.id === product.id);
      if (existing) {
        return prev.map(l => l.product.id === product.id
          ? { ...l, quantity: l.quantity + Math.max(1, product.minimum_order) }
          : l);
      }
      return [...prev, { product, quantity: Math.max(1, product.minimum_order) }];
    });
    setPicking(false);
    setProductSearch('');
  }, []);

  const setQty = useCallback((productId: number, quantity: number) => {
    setLines(prev => prev.map(l => l.product.id === productId ? { ...l, quantity } : l));
  }, []);

  const removeLine = useCallback((productId: number) => {
    setLines(prev => prev.filter(l => l.product.id !== productId));
  }, []);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!customer)                 e.customer = 'Choose the pharmacy this order is for.';
    if (lines.length === 0)        e.items    = 'Add at least one product.';
    if (street.trim().length < 8)  e.street   = 'Enter the full street address (at least 8 characters).';
    if (city.trim().length   < 2)  e.city     = 'Enter the city.';
    if (state.trim().length  < 2)  e.state    = 'Enter the state.';
    if (phone.trim().length  < 8)  e.phone    = 'Enter a contact number for delivery.';
    if (method === 'payment_received' && reference.trim().length < 2) {
      e.reference = 'Enter the teller, POS or transfer reference.';
    }
    // The API enforces minimum_order per line; catch it here so the rep sees
    // which product is wrong rather than a single generic 400.
    for (const l of lines) {
      if (l.quantity < l.product.minimum_order) {
        e.items = `${l.product.brand_name} has a minimum order of ${l.product.minimum_order}.`;
        break;
      }
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  }, [customer, lines, street, city, state, phone, method, reference]);

  const submit = useCallback(async () => {
    if (busy) return;
    if (!validate() || !customer) return;

    setBusy(true);
    try {
      const res = await createOrderOnBehalf({
        customer_id:    customer.id,
        items:          lines.map(l => ({ product_id: l.product.id, quantity: l.quantity })),
        state:          state.trim(),
        city:           city.trim(),
        street_address: street.trim(),
        contact_phone:  phone.trim(),
        delivery_notes: notes.trim() || undefined,
        po_number:      po.trim() || undefined,
        payment_method: method,
        received_via:      method === 'payment_received' ? via : undefined,
        payment_reference: method === 'payment_received' ? reference.trim() : undefined,
        payment_note:      method === 'payment_received' ? (payNote.trim() || undefined) : undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`${res.order_number} created for ${customer.company_name ?? 'the customer'}.`, 'Order placed');
      router.replace(`/(staff)/orders/${res.order_id}` as never);
    } catch (err) {
      toast.error((err as Error).message, 'Could not place order');
      setBusy(false);
    }
  }, [busy, validate, customer, lines, state, city, street, phone, notes, po,
      method, via, reference, payNote, queryClient, router]);

  /* ── Product picker ── */
  if (picking) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScreenHeader
            variant="compact"
            back
            onBack={() => { setPicking(false); setProductSearch(''); }}
            title="Add products"
          />

          <View style={{ paddingHorizontal: gutter, paddingBottom: space.md }}>
            <Input
              placeholder="Search brand, generic or SKU"
              value={productSearch}
              onChangeText={setProductSearch}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              leading={<Icon name="search" size={17} color={color.textTertiary} />}
            />
          </View>

          <FlatList
            data={productsQ.data?.records ?? []}
            keyExtractor={p => p.sku}
            contentContainerStyle={{ paddingHorizontal: gutter, gap: space.sm, paddingBottom: space['3xl'] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ProductPickRow
                product={item}
                inOrder={lines.some(l => l.product.id === item.id)}
                onPress={() => addProduct(item)}
              />
            )}
            ListEmptyComponent={
              productsQ.isLoading ? (
                <View style={{ gap: space.sm }}>
                  {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
                </View>
              ) : (
                <EmptyState
                  iconName="search"
                  compact
                  title="No products found"
                  subtitle={productSearch ? `Nothing matches “${productSearch}”.` : 'Start typing to search the catalogue.'}
                />
              )
            }
          />
        </SafeAreaView>
      </View>
    );
  }

  /* ── Main ── */
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="New order"
          subtitle="On a customer’s behalf"
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 56}
        >
          <ScrollView
            contentContainerStyle={{ padding: gutter, gap: space.xl, paddingBottom: 220 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── 1. Customer ── */}
            <Section step="1" title="Which pharmacy?" error={errs.customer}>
              {customer ? (
                <Surface level="sm" padded="base" rounded="lg">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: radius.full,
                      backgroundColor: color.brandSoft,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name="building" size={17} color={color.brand} filled />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>
                        {customer.company_name ?? `${customer.user.first_name} ${customer.user.last_name}`}
                      </Text>
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        {customer.user.email}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => { setCustomer(null); setLines([]); }}
                      haptic="light"
                      pressOpacity={0.6}
                      hitSlop={8}
                      disabled={busy}
                    >
                      <Text variant="label" tone="brand">Change</Text>
                    </Pressable>
                  </View>
                </Surface>
              ) : (
                <View style={{ gap: space.sm }}>
                  <Input
                    placeholder="Search approved pharmacies"
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    leading={<Icon name="search" size={17} color={color.textTertiary} />}
                  />

                  {customersQ.isLoading ? (
                    <RowSkeleton />
                  ) : (customersQ.data?.records.length ?? 0) === 0 ? (
                    <Surface tone="subtle" level="none" padded="base" rounded="md">
                      <Text variant="caption" tone="tertiary">
                        {customerSearch
                          ? 'No approved pharmacy matches that search.'
                          : 'Search by pharmacy name, contact or email. Only approved accounts can be ordered for.'}
                      </Text>
                    </Surface>
                  ) : (
                    <Surface level="sm" padded="none" rounded="lg">
                      {(customersQ.data?.records ?? []).slice(0, 6).map((c, i, arr) => (
                        <Pressable
                          key={c.id}
                          onPress={() => setCustomer(c)}
                          haptic="light"
                          pressOpacity={0.6}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: space.md,
                            paddingHorizontal: space.base, paddingVertical: space.md,
                            borderBottomWidth: i === arr.length - 1 ? 0 : layout.hairlineWidth,
                            borderBottomColor: color.borderSubtle,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text variant="body" numberOfLines={1}>
                              {c.company_name ?? `${c.user.first_name} ${c.user.last_name}`}
                            </Text>
                            <Text variant="caption" tone="tertiary" numberOfLines={1}>
                              {[c.city, c.state].filter(Boolean).join(', ') || c.user.email}
                            </Text>
                          </View>
                          <Icon name="chevron-right" size={15} color={color.textDisabled} />
                        </Pressable>
                      ))}
                    </Surface>
                  )}
                </View>
              )}
            </Section>

            {/* ── 2. Items ── */}
            <Section step="2" title="What are they ordering?" error={errs.items}>
              <View style={{ gap: space.sm }}>
                {lines.map(line => (
                  <Animated.View
                    key={line.product.id}
                    entering={FadeInDown.duration(280)}
                    layout={Layout.springify().damping(18).stiffness(260)}
                  >
                    <Surface level="sm" padded="md" rounded="lg">
                      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                        <View style={{
                          width: 46, height: 46, borderRadius: radius.md,
                          backgroundColor: color.surfaceSubtle,
                          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        }}>
                          {line.product.primary_image ? (
                            <Image
                              source={{ uri: line.product.primary_image }}
                              style={{ width: '76%', height: '76%' }}
                              contentFit="contain"
                              cachePolicy="memory-disk"
                            />
                          ) : (
                            <Icon name="product" size={18} color={color.textDisabled} />
                          )}
                        </View>

                        <View style={{ flex: 1, gap: 2 }}>
                          <Text variant="bodyMedium" numberOfLines={1}>{line.product.brand_name}</Text>
                          <Text variant="caption" tone="tertiary">
                            {formatNaira(line.product.final_price ?? line.product.selling_price)} each
                            {line.product.minimum_order > 1 ? ` · min ${line.product.minimum_order}` : ''}
                          </Text>
                        </View>

                        <Text variant="bodyMedium">
                          {formatNaira((line.product.final_price ?? line.product.selling_price) * line.quantity)}
                        </Text>
                      </View>

                      <View style={{ marginTop: space.sm, alignItems: 'flex-start' }}>
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          min={line.product.minimum_order}
                          max={Math.max(line.product.minimum_order, line.product.total_stock)}
                          onChange={q => setQty(line.product.id, q)}
                          onRemove={() => removeLine(line.product.id)}
                          disabled={busy}
                        />
                      </View>
                    </Surface>
                  </Animated.View>
                ))}

                <Button
                  variant={lines.length ? 'secondary' : 'tinted'}
                  fullWidth
                  onPress={() => setPicking(true)}
                  disabled={busy}
                  icon={<Icon name="plus" size={16} color={lines.length ? color.text : color.brand} />}
                >
                  {lines.length ? 'Add another product' : 'Add products'}
                </Button>
              </View>
            </Section>

            {/* ── 3. Delivery ── */}
            <Section
              step="3"
              title="Where's it going?"
              subtitle={customer ? 'Prefilled from their account — edit if this order goes elsewhere.' : undefined}
            >
              <Input
                label="Street address"
                value={street}
                onChangeText={t => { setStreet(t); setErrs(p => ({ ...p, street: '' })); }}
                error={errs.street}
                editable={!busy}
                multiline
                required
                leading={<Icon name="location" size={17} color={color.textTertiary} />}
              />

              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Input
                  label="City"
                  value={city}
                  onChangeText={t => { setCity(t); setErrs(p => ({ ...p, city: '' })); }}
                  error={errs.city}
                  editable={!busy}
                  required
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="State"
                  value={state}
                  onChangeText={t => { setState(t); setErrs(p => ({ ...p, state: '' })); }}
                  error={errs.state}
                  editable={!busy}
                  required
                  containerStyle={{ flex: 1 }}
                />
              </View>

              <Input
                label="Contact phone"
                value={phone}
                onChangeText={t => { setPhone(t); setErrs(p => ({ ...p, phone: '' })); }}
                error={errs.phone}
                keyboardType="phone-pad"
                editable={!busy}
                required
                leading={<Icon name="phone" size={17} color={color.textTertiary} />}
              />

              <Input
                label="Delivery notes"
                placeholder="Optional"
                value={notes}
                onChangeText={setNotes}
                editable={!busy}
                multiline
              />

              <Input
                label="Their PO number"
                placeholder="Optional"
                value={po}
                onChangeText={setPo}
                autoCapitalize="characters"
                editable={!busy}
              />
            </Section>

            {/* ── 4. Payment ── */}
            <Section step="4" title="How is it being paid?">
              <View style={{ gap: space.sm }}>
                {METHODS.map(m => {
                  const active = method === m.value;
                  return (
                    <Pressable
                      key={m.value}
                      onPress={() => setMethod(m.value)}
                      disabled={busy}
                      haptic="light"
                      pressScale={0.98}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: space.md,
                        padding: space.base,
                        borderRadius: radius.lg,
                        backgroundColor: active ? color.brandSoft : color.surface,
                        borderWidth: active ? 1.5 : layout.hairlineWidth,
                        borderColor: active ? color.brand : color.border,
                      }}
                    >
                      <View style={{
                        width: 34, height: 34, borderRadius: radius.full,
                        backgroundColor: active ? color.brand : color.surfaceMuted,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name={m.icon} size={15} color={active ? '#fff' : color.textTertiary} filled={active} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium">{m.label}</Text>
                        <Text variant="caption" tone="tertiary">{m.hint}</Text>
                      </View>
                      <View style={{
                        width: 20, height: 20, borderRadius: radius.full,
                        borderWidth: active ? 0 : 1.5,
                        borderColor: color.borderStrong,
                        backgroundColor: active ? color.brand : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {active ? <Icon name="check" size={11} color="#fff" /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {method === 'payment_received' ? (
                <Animated.View entering={FadeIn.duration(240)} style={{ gap: space.base }}>
                  <Surface tone="subtle" level="none" padded="base" rounded="lg">
                    <View style={{ gap: space.base }}>
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <Icon name="shield" size={15} color={color.accent} filled />
                        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                          Recorded against your name in the audit trail. Use the real
                          reference from the slip.
                        </Text>
                      </View>

                      <View style={{ gap: space.sm }}>
                        <Text variant="label" tone="secondary">Collected via</Text>
                        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                          {RECEIVED_VIA.map(v => {
                            const active = via === v.value;
                            return (
                              <Pressable
                                key={v.value}
                                onPress={() => setVia(v.value)}
                                haptic="light"
                                pressScale={0.95}
                                disabled={busy}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                                style={{
                                  paddingHorizontal: space.base, height: 34,
                                  justifyContent: 'center', borderRadius: radius.full,
                                  backgroundColor: active ? color.text : color.surface,
                                  borderWidth: layout.hairlineWidth,
                                  borderColor: active ? color.text : color.border,
                                }}
                              >
                                <Text variant="caption" style={{
                                  color: active ? '#fff' : color.textSecondary,
                                  fontWeight: active ? '700' : '500',
                                }}>
                                  {v.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <Input
                        label="Payment reference"
                        placeholder="Teller no. / POS slip / transfer ref"
                        value={reference}
                        onChangeText={t => { setReference(t); setErrs(p => ({ ...p, reference: '' })); }}
                        error={errs.reference}
                        autoCapitalize="characters"
                        editable={!busy}
                        required
                      />

                      <Input
                        label="Note"
                        placeholder="Optional"
                        value={payNote}
                        onChangeText={setPayNote}
                        editable={!busy}
                        multiline
                      />
                    </View>
                  </Surface>
                </Animated.View>
              ) : null}
            </Section>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Action bar ── */}
        <View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            paddingHorizontal: gutter,
            paddingTop: space.base,
            paddingBottom: Math.max(insets.bottom, space.base),
            backgroundColor: color.surface,
            borderTopWidth: layout.hairlineWidth,
            borderTopColor: color.border,
            gap: space.md,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="callout" tone="tertiary">
              {lines.length} {lines.length === 1 ? 'line' : 'lines'}
            </Text>
            <Text variant="title3">{formatNaira(subtotal)}</Text>
          </View>

          <Button
            size="lg"
            fullWidth
            haptic="medium"
            loading={busy}
            disabled={busy || !customer || lines.length === 0}
            onPress={submit}
          >
            {busy ? 'Placing order…' : 'Place order'}
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function Section({ step, title, subtitle, error, children }: {
  step: string;
  title: string;
  subtitle?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{
          width: 22, height: 22, borderRadius: radius.full,
          backgroundColor: error ? color.danger : color.text,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text variant="caption" style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{step}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline">{title}</Text>
          {subtitle ? <Text variant="caption" tone="tertiary">{subtitle}</Text> : null}
        </View>
      </View>

      {error ? <Text variant="caption" tone="danger">{error}</Text> : null}

      <View style={{ gap: space.md }}>{children}</View>
    </View>
  );
}

function ProductPickRow({ product, inOrder, onPress }: {
  product: CatalogProduct; inOrder: boolean; onPress: () => void;
}) {
  const price = product.final_price ?? product.selling_price;
  const unpriced = price <= 0;

  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      pressScale={0.985}
      disabled={!product.in_stock || unpriced}
      accessibilityRole="button"
      accessibilityLabel={`${product.brand_name}, ${unpriced ? 'no price set' : formatNaira(price)}`}
    >
      <Surface
        level="sm"
        padded="md"
        rounded="lg"
        style={{ opacity: product.in_stock && !unpriced ? 1 : 0.5 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{
            width: 42, height: 42, borderRadius: radius.md,
            backgroundColor: color.surfaceSubtle,
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {product.primary_image ? (
              <Image
                source={{ uri: product.primary_image }}
                style={{ width: '76%', height: '76%' }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <Icon name="product" size={17} color={color.textDisabled} />
            )}
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyMedium" numberOfLines={1}>{product.brand_name}</Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {[product.generic_name, product.pack_size].filter(Boolean).join(' · ') || product.sku}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <Text variant="caption" tone={unpriced ? 'danger' : 'secondary'}>
                {unpriced ? 'No price set' : formatNaira(price)}
              </Text>
              {!product.in_stock ? (
                <Badge tone="danger" size="sm">Out of stock</Badge>
              ) : (
                <Text variant="caption" tone="disabled">{product.total_stock} in stock</Text>
              )}
            </View>
          </View>

          {inOrder ? (
            <Badge tone="brand" size="sm">Added</Badge>
          ) : (
            <Icon name="plus" size={17} color={color.brand} />
          )}
        </View>
      </Surface>
    </Pressable>
  );
}
