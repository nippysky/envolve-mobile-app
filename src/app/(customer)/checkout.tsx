/**
 * Checkout.
 *
 * Three steps in one scroll: where it goes, how it's paid, and confirm. A
 * multi-screen wizard would be wrong here — the customer has already decided
 * to buy, and every screen between them and that is a chance to abandon.
 *
 * Payment flow (the part with real ordering constraints)
 * ──────────────────────────────────────────────────────
 * `POST /api/orders` re-verifies a Paystack reference server-side before it
 * will touch inventory, so the sequence has to be:
 *
 *   initiate → pay in the browser sheet → verify → create the order
 *
 * Not "create the order then pay". Doing it the other way round leaves an
 * unpaid order behind every time someone closes the payment sheet, and those
 * orders hold stock. Bank transfer and cash on delivery skip straight to
 * creation because there's nothing to verify yet — staff settle those manually.
 *
 * If verification succeeds but order creation then fails, the customer has paid
 * with no order to show for it. That case is surfaced loudly with the payment
 * reference, because it needs a human, and a generic "something went wrong"
 * would leave them with no way to prove they paid.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Text, Button, Input, Pressable, Icon, Surface, Sheet, SheetOption, SelectField,
} from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { color, space, radius, gutter, layout } from '@/constants/theme';
import { formatNaira } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { useBasket } from '@/hooks/use-basket';
import {
  initiatePayment, verifyPayment, placeOrder, type PaymentMethod,
} from '@/lib/services/orders.service';
import { getMyAccount } from '@/lib/services/account.service';
import { toast } from '@/lib/toast';

const METHODS: {
  value: PaymentMethod;
  label: string;
  hint: string;
  icon: 'card' | 'bank' | 'money';
}[] = [
  { value: 'paystack',         label: 'Pay now by card',   hint: 'Secured by Paystack — confirmed instantly', icon: 'card' },
  { value: 'bank_transfer',    label: 'Bank transfer',     hint: 'We’ll email an invoice with our account details', icon: 'bank' },
  { value: 'cash_on_delivery', label: 'Cash on delivery',  hint: 'Pay the driver when your order arrives', icon: 'money' },
];

type Phase = 'idle' | 'initiating' | 'awaiting_payment' | 'verifying' | 'placing';

export default function CheckoutScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const basket  = useBasket();
  const queryClient = useQueryClient();

  const [street,  setStreet]  = useState('');
  const [city,    setCity]    = useState('');
  const [state,   setState]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [notes,   setNotes]   = useState('');
  const [po,      setPo]      = useState('');
  const [method,  setMethod]  = useState<PaymentMethod>('paystack');
  const [useCredit, setUseCredit] = useState(false);
  const [pickingMethod, setPickingMethod] = useState(false);

  const [phase,  setPhase]  = useState<Phase>('idle');
  const [errs,   setErrs]   = useState<Record<string, string>>({});
  const [stranded, setStranded] = useState<string | null>(null);

  const busy = phase !== 'idle';
  const selectedMethod = METHODS.find(m => m.value === method)!;

  // Only in-stock lines are ordered. The basket screen blocks checkout when
  // nothing is orderable, so this can't be empty by the time we're here.
  const orderable = useMemo(() => basket.items.filter(i => i.in_stock), [basket.items]);
  const subtotal  = useMemo(
    () => orderable.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    [orderable],
  );

  // Referral wallet. `redeemable` is already gated server-side by the business
  // toggle and the minimum balance, so a non-zero value here means it really
  // can be spent — no second guess needed on the client.
  const accountQ = useQuery({
    queryKey: ['account', 'me'],
    queryFn:  getMyAccount,
    staleTime: 60_000,
  });

  const redeemable = accountQ.data?.referral.redeemable ?? 0;
  const canRedeem  = redeemable > 0;

  // Credit is a discount, never a payout — it can't exceed the goods total.
  const creditApplied = useCredit && canRedeem ? Math.min(redeemable, subtotal) : 0;
  const payable       = Math.max(0, subtotal - creditApplied);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    // Mirrors the API's zod schema so failures surface here, not at submit.
    if (street.trim().length < 8) e.street = 'Enter the full street address (at least 8 characters).';
    if (city.trim().length   < 2) e.city   = 'Enter your city.';
    if (state.trim().length  < 2) e.state  = 'Enter your state.';
    if (phone.trim().length  < 8) e.phone  = 'Enter a phone number we can reach on delivery.';
    setErrs(e);
    return Object.keys(e).length === 0;
  }, [street, city, state, phone]);

  const createOrder = useCallback(async (paystackReference?: string) => {
    setPhase('placing');
    const res = await placeOrder({
      items: orderable.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      state:          state.trim(),
      city:           city.trim(),
      street_address: street.trim(),
      contact_phone:  phone.trim(),
      delivery_notes: notes.trim() || undefined,
      po_number:      po.trim() || undefined,
      payment_method: method,
      paystack_reference: paystackReference,
      referral_credit: creditApplied || undefined,
    });

    // The server clears the cart on success; mirror that locally and drop any
    // cached order list so the new order is there when we land on it.
    await basket.refresh();
    await queryClient.invalidateQueries({ queryKey: ['orders'] });

    toast.success(`Order ${res.order_number} placed.`, 'Thank you');
    router.replace(`/(customer)/orders/${res.order_id}` as never);
  }, [orderable, state, city, street, phone, notes, po, method, creditApplied,
      basket, queryClient, router]);

  const submit = useCallback(async () => {
    if (busy || orderable.length === 0) return;
    if (!validate()) return;

    setStranded(null);

    try {
      if (method !== 'paystack') {
        await createOrder();
        return;
      }

      /* ── Paystack ── */
      setPhase('initiating');
      const init = await initiatePayment({
        // Charge only what's left after credit — the server applies the same
        // discount when it creates the order, so the two must agree.
        amount: payable,
        metadata: { source: 'mobile', customer_email: user?.email },
      });

      setPhase('awaiting_payment');
      const result = await WebBrowser.openBrowserAsync(init.authorization_url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        dismissButtonStyle: 'cancel',
        toolbarColor: color.bg,
      });

      // The sheet closes on both success and cancel with no usable signal, so
      // the reference is verified against Paystack rather than trusted from
      // the browser result.
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setPhase('verifying');
        const check = await verifyPayment(init.reference);
        if (!check.verified) {
          setPhase('idle');
          toast.info('No payment was completed. Your basket is untouched.', 'Payment cancelled');
          return;
        }
      } else {
        setPhase('verifying');
        const check = await verifyPayment(init.reference);
        if (!check.verified) {
          setPhase('idle');
          toast.error(check.message || 'The payment could not be confirmed.', 'Payment not confirmed');
          return;
        }
      }

      try {
        await createOrder(init.reference);
      } catch (err) {
        // Paid, but the order didn't get created. This needs a person.
        setStranded(init.reference);
        setPhase('idle');
        throw err;
      }
    } catch (err) {
      setPhase('idle');
      if (!stranded) toast.error((err as Error).message, 'Checkout failed');
    }
    // `user`, not `user?.email`. The narrower dependency looks tighter, but the
    // React Compiler infers the whole object and refuses to optimize a
    // component whose manual deps it can't reconcile — so the entire checkout
    // screen was being skipped. `user` only changes identity on sign-in or
    // sign-out, so this recreates the callback no more often in practice.
  }, [busy, orderable, validate, method, payable, user, createOrder, stranded]);

  const phaseLabel: Record<Phase, string> = {
    idle:             '',
    initiating:       'Setting up payment…',
    awaiting_payment: 'Waiting for payment…',
    verifying:        'Confirming payment…',
    placing:          'Placing your order…',
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScreenHeader
          variant="compact"
          back
          title="Checkout"
          subtitle={`${orderable.length} ${orderable.length === 1 ? 'line' : 'lines'}`}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 56}
        >
          <ScrollView
            contentContainerStyle={{ padding: gutter, gap: space.xl, paddingBottom: 200 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Stranded payment — highest priority, sits above everything. */}
            {stranded ? (
              <Animated.View entering={FadeIn.duration(240)}>
                <Surface tone="danger" level="none" padded="base" rounded="lg">
                  <View style={{ gap: space.sm }}>
                    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                      <Icon name="alert" size={17} color={color.danger} filled />
                      <Text variant="bodyMedium" style={{ color: '#991b1b' }}>
                        Payment went through, order didn’t
                      </Text>
                    </View>
                    <Text variant="callout" style={{ color: '#b91c1c' }}>
                      Your card was charged but we couldn’t create the order. Nothing
                      is lost — send this reference to our team and they’ll complete
                      it for you.
                    </Text>
                    <View style={{
                      padding: space.md, borderRadius: radius.md,
                      backgroundColor: 'rgba(255,255,255,0.65)',
                    }}>
                      <Text variant="mono" style={{ color: '#991b1b' }}>{stranded}</Text>
                    </View>
                  </View>
                </Surface>
              </Animated.View>
            ) : null}

            {/* ── Delivery ── */}
            <Section
              index={0}
              step="1"
              title="Where should we deliver?"
              subtitle="We deliver to registered pharmacy premises only."
            >
              <Input
                label="Street address"
                placeholder="12 Awolowo Road, Ikoyi"
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
                  placeholder="Lagos"
                  value={city}
                  onChangeText={t => { setCity(t); setErrs(p => ({ ...p, city: '' })); }}
                  error={errs.city}
                  editable={!busy}
                  required
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="State"
                  placeholder="Lagos"
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
                placeholder="0805 513 6726"
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
                hint="Gate code, landmark, or who to ask for"
                placeholder="Optional"
                value={notes}
                onChangeText={setNotes}
                editable={!busy}
                multiline
              />

              <Input
                label="Purchase order number"
                hint="If your pharmacy requires one on the invoice"
                placeholder="Optional"
                value={po}
                onChangeText={setPo}
                autoCapitalize="characters"
                editable={!busy}
              />
            </Section>

            {/* ── Payment ── */}
            <Section index={1} step="2" title="How would you like to pay?">
              {/* Referral credit. Only rendered when there's something spendable
                  — the server gates redemption on a business toggle and a
                  minimum balance, and `redeemable` already reflects both, so an
                  empty state here would just be noise. */}
              {canRedeem ? (
                <Pressable
                  onPress={() => setUseCredit(v => !v)}
                  disabled={busy}
                  haptic="light"
                  pressScale={0.98}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: useCredit, disabled: busy }}
                  accessibilityLabel={`Apply ${formatNaira(Math.min(redeemable, subtotal))} referral credit`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.md,
                    padding: space.base,
                    borderRadius: radius.lg,
                    backgroundColor: useCredit ? color.successSoft : color.surface,
                    borderWidth: useCredit ? 1.5 : layout.hairlineWidth,
                    borderColor: useCredit ? color.success : color.border,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: radius.full,
                    backgroundColor: useCredit ? color.success : color.surfaceMuted,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon
                      name="referrals"
                      size={16}
                      color={useCredit ? '#fff' : color.textTertiary}
                      filled={useCredit}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">Use your referral credit</Text>
                    <Text variant="caption" tone="tertiary">
                      {formatNaira(redeemable)} available
                      {redeemable > subtotal ? ` · ${formatNaira(subtotal)} applies to this order` : ''}
                    </Text>
                  </View>

                  <View style={{
                    width: 20, height: 20, borderRadius: radius.full,
                    borderWidth: useCredit ? 0 : 1.5,
                    borderColor: color.borderStrong,
                    backgroundColor: useCredit ? color.success : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {useCredit ? <Icon name="check" size={11} color="#fff" /> : null}
                  </View>
                </Pressable>
              ) : null}

              {/* One row instead of three stacked cards. Checkout is where
                  scroll length hurts most — every extra screen between the
                  basket and the pay button is a chance to abandon. */}
              <SelectField
                icon={selectedMethod.icon}
                value={selectedMethod.label}
                caption={selectedMethod.hint}
                disabled={busy}
                onPress={() => setPickingMethod(true)}
              />
            </Section>

            {/* ── Summary ── */}
            <Section index={2} step="3" title="Review">
              <Surface level="sm" padded="base" rounded="lg">
                <View style={{ gap: space.sm }}>
                  {orderable.map(i => (
                    <View key={i.id} style={{ flexDirection: 'row', gap: space.sm }}>
                      <Text variant="callout" tone="tertiary" style={{ minWidth: 28 }}>
                        {i.quantity}×
                      </Text>
                      <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>
                        {i.brand_name}
                      </Text>
                      <Text variant="callout">{formatNaira(i.unit_price * i.quantity)}</Text>
                    </View>
                  ))}

                  <View style={{
                    height: layout.hairlineWidth,
                    backgroundColor: color.borderSubtle,
                    marginVertical: space.xs,
                  }} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="callout" tone="tertiary">Subtotal</Text>
                    <Text variant="bodyMedium">{formatNaira(subtotal)}</Text>
                  </View>
                  {creditApplied > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="callout" tone="tertiary">Referral credit</Text>
                      <Text variant="bodyMedium" tone="success">
                        − {formatNaira(creditApplied)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="callout" tone="tertiary">Delivery</Text>
                    <Text variant="caption" tone="tertiary">Confirmed by our team</Text>
                  </View>
                </View>
              </Surface>
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
            <Text variant="callout" tone="tertiary">Total due now</Text>
            <Text variant="title3">
              {method === 'cash_on_delivery' ? formatNaira(0) : formatNaira(payable)}
            </Text>
          </View>

          <Button
            size="lg"
            fullWidth
            haptic="medium"
            loading={busy}
            disabled={busy || orderable.length === 0}
            onPress={submit}
          >
            {busy
              ? phaseLabel[phase]
              : method === 'paystack'
                ? `Pay ${formatNaira(payable)}`
                : 'Place order'}
          </Button>

          <Text variant="caption" tone="disabled" align="center">
            {method === 'paystack'
              ? 'You’ll be taken to Paystack to complete payment securely.'
              : method === 'bank_transfer'
                ? 'Your order is confirmed once we receive the transfer.'
                : 'Please have the exact amount ready for the driver.'}
          </Text>
        </View>
      </SafeAreaView>

      <Sheet
        visible={pickingMethod}
        onClose={() => setPickingMethod(false)}
        title="How would you like to pay?"
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
    </View>
  );
}

/* ── Section ────────────────────────────────────────────────────────────── */

function Section({
  index, step, title, subtitle, children }: {
  index: number;
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(360)}
      style={{ gap: space.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{
          width: 22, height: 22, borderRadius: radius.full,
          backgroundColor: color.text,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text variant="caption" style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {step}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline">{title}</Text>
          {subtitle ? <Text variant="caption" tone="tertiary">{subtitle}</Text> : null}
        </View>
      </View>

      <View style={{ gap: space.md }}>{children}</View>
    </Animated.View>
  );
}
