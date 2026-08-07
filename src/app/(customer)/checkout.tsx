import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { formatNaira } from '@/lib/format';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

type PaymentMethod = 'paystack' | 'bank_transfer' | 'cash_on_delivery';

interface CartItem {
  id:         number;
  product_id: number;
  quantity:   number;
  unit_price: number;
  subtotal:   number;
  brand_name: string;
}

interface CartData {
  cart: { items: CartItem[]; subtotal: number; item_count: number };
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string; desc: string }[] = [
  { value: 'paystack',          label: 'Pay Online',       icon: '💳', desc: 'Pay securely with card or bank transfer via Paystack' },
  { value: 'bank_transfer',     label: 'Bank Transfer',    icon: '🏦', desc: 'Transfer to our account — we confirm before dispatch' },
  { value: 'cash_on_delivery',  label: 'Cash on Delivery', icon: '💵', desc: 'Pay in cash when your order is delivered' },
];

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();

  // Delivery address fields
  const [streetAddress,  setStreetAddress]  = useState('');
  const [city,           setCity]           = useState('');
  const [state,          setState]          = useState('');
  const [phone,          setPhone]          = useState('');
  const [notes,          setNotes]          = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('paystack');
  const [errors,         setErrors]         = useState<Record<string, string>>({});

  // Load cart to show summary + build order items
  const { data: cartData, isLoading: cartLoading } = useQuery({
    queryKey: ['cart'],
    queryFn:  () => api.get<CartData>('/api/cart'),
  });
  const cart  = cartData?.cart;
  const items = cart?.items ?? [];

  const placeOrder = useMutation({
    mutationFn: () =>
      api.post<{ order: { id: number; order_number: string } }>('/api/orders', {
        items:           items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        street_address:  streetAddress.trim(),
        city:            city.trim(),
        state:           state.trim(),
        contact_phone:   phone.trim(),
        delivery_notes:  notes.trim() || undefined,
        payment_method:  paymentMethod,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['customer-orders'] });
      const orderId = (res as any)?.order?.id;
      toast.success(
        paymentMethod === 'paystack'
          ? 'Order placed! You will receive a payment link shortly.'
          : 'Order placed successfully!',
        '🎉 Order Placed!',
      );
      if (orderId) {
        router.replace(`/(customer)/orders/${orderId}`);
      } else {
        router.replace('/(customer)/orders');
      }
    },
    onError: (e) => {
      toast.error(
        e instanceof ApiError ? e.message : 'Something went wrong. Please try again.',
        'Order Failed',
      );
    },
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!streetAddress.trim()) errs.streetAddress = 'Street address is required.';
    if (!city.trim())          errs.city          = 'City is required.';
    if (!state.trim())         errs.state         = 'State is required.';
    if (!phone.trim())         errs.phone         = 'Contact phone is required.';
    else if (phone.trim().replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid phone number.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handlePlaceOrder() {
    if (items.length === 0) {
      toast.info('Add items to your cart before placing an order.', 'Cart is empty');
      return;
    }
    if (!validate()) return;
    placeOrder.mutate();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.white }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Checkout" back onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Order summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {cartLoading ? (
            <Text style={styles.loadingText}>Loading cart…</Text>
          ) : (
            <>
              {items.map(item => (
                <View key={item.id} style={styles.summaryItem}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.brand_name}</Text>
                  <Text style={styles.itemQty}>×{item.quantity}</Text>
                  <Text style={styles.itemTotal}>{formatNaira(item.subtotal)}</Text>
                </View>
              ))}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal</Text>
                <Text style={styles.subtotalValue}>{formatNaira(cart?.subtotal ?? 0)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Delivery address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>

          <Input
            label="Street Address"
            placeholder="15 Herbert Macaulay Way"
            value={streetAddress}
            onChangeText={setStreetAddress}
            error={errors.streetAddress}
            returnKeyType="next"
          />
          <Input
            label="City"
            placeholder="Ikeja"
            value={city}
            onChangeText={setCity}
            error={errors.city}
            returnKeyType="next"
          />
          <Input
            label="State"
            placeholder="Lagos"
            value={state}
            onChangeText={setState}
            error={errors.state}
            returnKeyType="next"
          />
          <Input
            label="Contact Phone"
            placeholder="080 0000 0000"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            keyboardType="phone-pad"
            returnKeyType="next"
          />
          <Input
            label="Delivery Notes (optional)"
            placeholder="Leave at the gate, ring bell twice…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            returnKeyType="done"
          />
        </View>

        {/* Payment method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {PAYMENT_METHODS.map(pm => (
            <Pressable
              key={pm.value}
              style={[styles.pmCard, paymentMethod === pm.value && styles.pmCardActive]}
              onPress={() => setPaymentMethod(pm.value)}
            >
              <Text style={styles.pmIcon}>{pm.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pmLabel, paymentMethod === pm.value && styles.pmLabelActive]}>
                  {pm.label}
                </Text>
                <Text style={styles.pmDesc}>{pm.desc}</Text>
              </View>
              <View style={[styles.radio, paymentMethod === pm.value && styles.radioActive]}>
                {paymentMethod === pm.value && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={placeOrder.isPending}
          disabled={items.length === 0}
          onPress={handlePlaceOrder}
        >
          Place Order
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:     { padding: 20, gap: 8 },
  section:    { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.ink, marginBottom: 14 },
  loadingText:{ fontSize: 14, color: Colors.ink4 },

  summaryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  itemName:    { flex: 1, fontSize: 14, color: Colors.ink },
  itemQty:     { fontSize: 13, color: Colors.ink3 },
  itemTotal:   { fontSize: 14, fontWeight: '700', color: Colors.ink },

  subtotalRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.line },
  subtotalLabel: { fontSize: 15, fontWeight: '600', color: Colors.ink2 },
  subtotalValue: { fontSize: 17, fontWeight: '800', color: Colors.ink },

  pmCard: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         14,
    borderRadius:    12,
    borderWidth:     1.5,
    borderColor:     Colors.line,
    marginBottom:    10,
    gap:             12,
  },
  pmCardActive: { borderColor: Colors.brand, backgroundColor: Colors.brand + '08' },
  pmIcon:       { fontSize: 22 },
  pmLabel:      { fontSize: 14, fontWeight: '700', color: Colors.ink },
  pmLabelActive:{ color: Colors.brand },
  pmDesc:       { fontSize: 12, color: Colors.ink4, marginTop: 2, lineHeight: 17 },

  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.ink4, alignItems: 'center', justifyContent: 'center' },
  radioActive:  { borderColor: Colors.brand },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brand },

  footer: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    padding:           16,
    paddingTop:        12,
    backgroundColor:   Colors.white,
    borderTopWidth:    1,
    borderTopColor:    Colors.line,
  },
});
