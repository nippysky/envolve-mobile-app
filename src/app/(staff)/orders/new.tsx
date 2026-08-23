/**
 * Place an order on a customer's behalf.
 *
 * This is the screen a rep uses with the pharmacist on the phone, so it's built
 * for one-handed use under time pressure: pick who, add what, say how it was
 * paid, send. Four steps, one scroll, no wizard.
 *
 * Why every choice lives in a sheet
 * ─────────────────────────────────
 * Laying the options out inline made the form four screens tall before the rep
 * had entered anything: a live search box plus six pharmacy results, then four
 * payment cards, then four "collected via" chips. All of that is scroll cost
 * for choices made once. Each is now a single row showing the current value,
 * with the options behind a sheet — so the whole order fits in roughly one
 * screen and reads as a summary you can check before sending.
 *
 * Why the payment step works the way it does
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

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Badge, QuantityStepper,
  EmptyState, RowSkeleton, Sheet, SheetOption, SelectField,
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
  { value: 'cash',          label: 'Cash',     hint: 'Notes taken at the counter' },
  { value: 'bank_transfer', label: 'Transfer', hint: 'Landed in the company account' },
  { value: 'pos',           label: 'POS',      hint: 'Card swiped on the terminal' },
  { value: 'other',         label: 'Other',    hint: 'Anything else — explain in the note' },
] as const;

type ReceivedVia = typeof RECEIVED_VIA[number]['value'];

function customerName(c: AdminCustomer): string {
  return c.company_name ?? `${c.user.first_name} ${c.user.last_name}`.trim();
}

export default function OnBehalfOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [lines,    setLines]    = useState<Line[]>([]);

  // One piece of state per sheet, rather than a single "which sheet" union —
  // they never overlap, and separate flags keep each sheet's props honest.
  const [pickingCustomer, setPickingCustomer] = useState(false);
  const [pickingProduct,  setPickingProduct]  = useState(false);
  const [pickingMethod,   setPickingMethod]   = useState(false);
  const [pickingVia,      setPickingVia]      = useState(false);

  const [street, setStreet] = useState('');
  const [city,   setCity]   = useState('');
  const [state,  setState]  = useState('');
  const [phone,  setPhone]  = useState('');
  const [notes,  setNotes]  = useState('');
  const [po,     setPo]     = useState('');

  const [method,    setMethod]    = useState<OnBehalfPaymentMethod>('payment_received');
  const [via,       setVia]       = useState<ReceivedVia>('cash');
  const [reference, setReference] = useState('');
  const [payNote,   setPayNote]   = useState('');

  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  // Prefill the delivery details from the account, then let the rep override.
  //
  // Adjusted during render rather than in an effect. Keyed on the customer id
  // so re-renders while the rep is typing don't overwrite what they've typed —
  // only actually switching pharmacy re-seeds.
  const [seededFor, setSeededFor] = useState<number | null>(null);
  if (customer && seededFor !== customer.id) {
    setSeededFor(customer.id);
    setStreet(customer.address ?? '');
    setCity(customer.city ?? '');
    setState(customer.state ?? '');
    setPhone(customer.user.phone ?? '');
  }

  const subtotal = useMemo(
    () => lines.reduce((s, l) => {
      const price = l.product.final_price ?? l.product.selling_price;
      return s + price * l.quantity;
    }, 0),
    [lines],
  );

  const units = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

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
    setErrs(p => ({ ...p, items: '' }));
    // Deliberately left open. Orders placed on the phone are rarely one line,
    // and closing after each pick means reopening and re-searching every time.
    // The row flips to "Added", which is the confirmation the rep needs.
  }, []);

  const setQty = useCallback((productId: number, quantity: number) => {
    setLines(prev => prev.map(l => l.product.id === productId ? { ...l, quantity } : l));
  }, []);

  const removeLine = useCallback((productId: number) => {
    setLines(prev => prev.filter(l => l.product.id !== productId));
  }, []);

  const chooseCustomer = useCallback((c: AdminCustomer) => {
    setCustomer(c);
    setErrs(p => ({ ...p, customer: '' }));
    setPickingCustomer(false);
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

  const selectedMethod = METHODS.find(m => m.value === method)!;
  const selectedVia    = RECEIVED_VIA.find(v => v.value === via)!;

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
            <Section step="1" title="Which pharmacy?" done={!!customer}>
              <SelectField
                icon="building"
                value={customer ? customerName(customer) : undefined}
                placeholder="Choose a pharmacy"
                caption={
                  customer
                    ? ([customer.city, customer.state].filter(Boolean).join(', ') || customer.user.email)
                    : 'Approved accounts only'
                }
                error={errs.customer}
                disabled={busy}
                onPress={() => setPickingCustomer(true)}
                action={customer ? <Text variant="label" tone="brand">Change</Text> : undefined}
              />
            </Section>

            {/* ── 2. Items ── */}
            <Section
              step="2"
              title="What are they ordering?"
              error={errs.items}
              done={lines.length > 0}
              trailing={lines.length > 0 ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : undefined}
            >
              <View style={{ gap: space.sm }}>
                {lines.map(line => (
                  <Animated.View
                    key={line.product.id}
                    entering={FadeInDown.duration(280)}
                    layout={Layout.springify().damping(18).stiffness(260)}
                  >
                    <Surface level="sm" padded="md" rounded="lg">
                      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                        <ProductThumb uri={line.product.primary_image} size={46} />

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
                  onPress={() => setPickingProduct(true)}
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
            <Section step="4" title="How is it being paid?" done>
              <SelectField
                icon={selectedMethod.icon}
                value={selectedMethod.label}
                caption={selectedMethod.hint}
                disabled={busy}
                onPress={() => setPickingMethod(true)}
              />

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

                      <SelectField
                        label="Collected via"
                        value={selectedVia.label}
                        caption={selectedVia.hint}
                        disabled={busy}
                        onPress={() => setPickingVia(true)}
                      />

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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {customer ? customerName(customer) : 'No pharmacy chosen'}
              </Text>
              <Text variant="caption" tone="disabled">
                {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                {units > 0 ? ` · ${units} ${units === 1 ? 'unit' : 'units'}` : ''}
              </Text>
            </View>
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

      {/* ── Sheets ── */}
      <CustomerSheet
        visible={pickingCustomer}
        selectedId={customer?.id ?? null}
        onClose={() => setPickingCustomer(false)}
        onSelect={chooseCustomer}
      />

      <ProductSheet
        visible={pickingProduct}
        inOrderIds={lines.map(l => l.product.id)}
        lineCount={lines.length}
        subtotal={subtotal}
        onClose={() => setPickingProduct(false)}
        onSelect={addProduct}
      />

      <Sheet
        visible={pickingMethod}
        onClose={() => setPickingMethod(false)}
        title="How is it being paid?"
        subtitle="Pick the option that matches what actually happened."
      >
        {METHODS.map((m, i) => (
          <SheetOption
            key={m.value}
            icon={m.icon}
            label={m.label}
            hint={m.hint}
            selected={method === m.value}
            last={i === METHODS.length - 1}
            onPress={() => { setMethod(m.value); setPickingMethod(false); }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={pickingVia}
        onClose={() => setPickingVia(false)}
        title="Collected via"
        subtitle="How the money reached you."
      >
        {RECEIVED_VIA.map((v, i) => (
          <SheetOption
            key={v.value}
            label={v.label}
            hint={v.hint}
            selected={via === v.value}
            last={i === RECEIVED_VIA.length - 1}
            onPress={() => { setVia(v.value); setPickingVia(false); }}
          />
        ))}
      </Sheet>
    </View>
  );
}

/* ── Customer sheet ─────────────────────────────────────────────────────────
   Only APPROVED customers can be ordered for — the API rejects the rest, so
   the picker never shows them rather than failing at submit.
   ────────────────────────────────────────────────────────────────────────── */

function CustomerSheet({ visible, selectedId, onClose, onSelect }: {
  visible: boolean;
  selectedId: number | null;
  onClose: () => void;
  onSelect: (c: AdminCustomer) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 350);

  // Scoped to the sheet, so the list isn't being fetched and held in memory
  // behind a form the rep may never open twice.
  const q = useQuery({
    queryKey: ['customers', 'approved', debounced],
    queryFn:  () => listCustomers({ search: debounced, status: 'APPROVED', limit: 25 }),
    enabled:  visible,
    staleTime: 30_000,
  });

  const records = q.data?.records ?? [];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      detent="tall"
      title="Choose a pharmacy"
      subtitle="Only approved accounts can be ordered for."
    >
      <View style={{ paddingHorizontal: gutter, paddingVertical: space.md }}>
        <Input
          placeholder="Search name, contact or email"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          leading={<Icon name="search" size={17} color={color.textTertiary} />}
        />
      </View>

      <FlatList
        data={records}
        keyExtractor={c => String(c.id)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space['3xl'] }}
        renderItem={({ item, index }) => (
          <SheetOption
            icon="building"
            label={customerName(item)}
            hint={[item.city, item.state].filter(Boolean).join(', ') || item.user.email}
            selected={selectedId === item.id}
            last={index === records.length - 1}
            onPress={() => onSelect(item)}
          />
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: space.sm, paddingHorizontal: gutter }}>
              {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
            </View>
          ) : (
            <View style={{ paddingHorizontal: gutter }}>
              <EmptyState
                iconName="search"
                compact
                title="No pharmacy found"
                subtitle={search
                  ? `Nothing approved matches “${search}”.`
                  : 'Search by pharmacy name, contact or email.'}
              />
            </View>
          )
        }
      />
    </Sheet>
  );
}

/* ── Product sheet ──────────────────────────────────────────────────────── */

function ProductSheet({ visible, inOrderIds, lineCount, subtotal, onClose, onSelect }: {
  visible: boolean;
  inOrderIds: number[];
  lineCount: number;
  subtotal: number;
  onClose: () => void;
  onSelect: (p: CatalogProduct) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 350);

  const q = useQuery({
    queryKey: ['catalog', 'products', 'on-behalf', debounced],
    queryFn:  () => listProducts({ search: debounced, limit: 25 }),
    enabled:  visible,
    staleTime: 60_000,
  });

  const records = q.data?.records ?? [];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      detent="tall"
      title="Add products"
      subtitle="Tap to add a line. The sheet stays open for the next one."
      footer={
        <Button fullWidth variant={lineCount ? 'primary' : 'secondary'} onPress={onClose}>
          {lineCount
            ? `Done · ${lineCount} ${lineCount === 1 ? 'line' : 'lines'} · ${formatNaira(subtotal)}`
            : 'Done'}
        </Button>
      }
    >
      <View style={{ paddingHorizontal: gutter, paddingVertical: space.md }}>
        <Input
          placeholder="Search brand, generic or SKU"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          leading={<Icon name="search" size={17} color={color.textTertiary} />}
        />
      </View>

      <FlatList
        data={records}
        keyExtractor={p => p.sku}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: space.sm, paddingBottom: space['3xl'] }}
        renderItem={({ item }) => (
          <ProductPickRow
            product={item}
            inOrder={inOrderIds.includes(item.id)}
            onPress={() => onSelect(item)}
          />
        )}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: space.sm }}>
              {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
            </View>
          ) : (
            <EmptyState
              iconName="search"
              compact
              title="No products found"
              subtitle={search ? `Nothing matches “${search}”.` : 'Start typing to search the catalogue.'}
            />
          )
        }
      />
    </Sheet>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */

function ProductThumb({ uri, size }: { uri?: string | null; size: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: radius.md,
      backgroundColor: color.surfaceSubtle,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '76%', height: '76%' }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      ) : (
        <Icon name="product" size={Math.round(size * 0.4)} color={color.textDisabled} />
      )}
    </View>
  );
}

function Section({ step, title, subtitle, error, done = false, trailing, children }: {
  step: string;
  title: string;
  subtitle?: string;
  error?: string;
  /** Swaps the step number for a tick once the step is satisfied. */
  done?: boolean;
  trailing?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{
          width: 22, height: 22, borderRadius: radius.full,
          backgroundColor: error ? color.danger : done ? color.accent : color.text,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {done && !error
            ? <Icon name="check" size={12} color="#fff" />
            : <Text variant="caption" style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{step}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline">{title}</Text>
          {subtitle ? <Text variant="caption" tone="tertiary">{subtitle}</Text> : null}
        </View>
        {trailing ? <Badge tone="neutral" size="sm">{trailing}</Badge> : null}
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
          <ProductThumb uri={product.primary_image} size={42} />

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
