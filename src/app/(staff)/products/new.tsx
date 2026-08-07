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
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

interface Category {
  id:   number;
  name: string;
  slug: string;
}

interface CategoriesResponse {
  categories: Category[];
}

type ProductStatus = 'ACTIVE' | 'DRAFT' | 'DISCONTINUED';

const STATUS_OPTIONS: { value: ProductStatus; label: string; desc: string; color: string }[] = [
  { value: 'ACTIVE',       label: 'Active',       desc: 'Visible in catalog, customers can order',    color: Colors.success },
  { value: 'DRAFT',        label: 'Draft',        desc: 'Hidden from catalog, not orderable',         color: Colors.ink3 },
  { value: 'DISCONTINUED', label: 'Discontinued', desc: 'No longer available, kept for order history', color: Colors.danger },
];

export default function AddProduct() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();

  const [brandName,        setBrandName]        = useState('');
  const [genericName,      setGenericName]      = useState('');
  const [strength,         setStrength]         = useState('');
  const [manufacturer,     setManufacturer]     = useState('');
  const [costPrice,        setCostPrice]        = useState('');
  const [sellingPrice,     setSellingPrice]     = useState('');
  const [initialStock,     setInitialStock]     = useState('');
  const [minOrderQty,      setMinOrderQty]      = useState('1');
  const [requiresPrescription, setRequiresPrescription] = useState(false);
  const [categoryId,       setCategoryId]       = useState<number | null>(null);
  const [status,           setStatus]           = useState<ProductStatus>('ACTIVE');
  const [errors,           setErrors]           = useState<Record<string, string>>({});

  const { data: catData } = useQuery({
    queryKey: ['product-categories'],
    queryFn:  () => api.get<CategoriesResponse>('/api/products/categories'),
  });
  const categories = catData?.categories ?? [];

  const createProduct = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        brand_name:       brandName.trim(),
        generic_name:     genericName.trim() || undefined,
        product_strength: strength.trim()    || undefined,
        manufacturer:     manufacturer.trim() || undefined,
        selling_price:    parseFloat(sellingPrice),
        status,
        requires_prescription: requiresPrescription,
      };
      if (costPrice)    body.cost_price    = parseFloat(costPrice);
      if (initialStock) body.initial_stock = parseInt(initialStock, 10);
      if (minOrderQty)  body.minimum_order = parseInt(minOrderQty, 10);
      if (categoryId)   body.category_id   = categoryId;
      return api.post<{ product: { id: number; sku: string } }>('/api/products', body);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['staff-products'] });
      const sku = (res as any)?.product?.sku ?? '';
      toast.success(`Product created${sku ? ` · SKU: ${sku}` : ''}.`, '✅ Product Created');
      router.back();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Failed to create product.');
    },
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!brandName.trim())   errs.brandName   = 'Brand name is required.';
    if (!sellingPrice.trim()) errs.sellingPrice = 'Selling price is required.';
    else if (isNaN(parseFloat(sellingPrice)) || parseFloat(sellingPrice) <= 0) {
      errs.sellingPrice = 'Enter a valid price greater than 0.';
    }
    if (costPrice && (isNaN(parseFloat(costPrice)) || parseFloat(costPrice) < 0)) {
      errs.costPrice = 'Enter a valid cost price.';
    }
    if (initialStock && isNaN(parseInt(initialStock, 10))) {
      errs.initialStock = 'Enter a valid stock quantity.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    createProduct.mutate();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Add Product" back onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Info</Text>
          <Input
            label="Brand Name *"
            placeholder="e.g. Panadol Extra"
            value={brandName}
            onChangeText={setBrandName}
            error={errors.brandName}
          />
          <Input
            label="Generic / Active Ingredient"
            placeholder="e.g. Paracetamol + Caffeine"
            value={genericName}
            onChangeText={setGenericName}
          />
          <Input
            label="Strength / Dosage"
            placeholder="e.g. 500mg/65mg"
            value={strength}
            onChangeText={setStrength}
          />
          <Input
            label="Manufacturer"
            placeholder="e.g. GlaxoSmithKline"
            value={manufacturer}
            onChangeText={setManufacturer}
          />
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <Input
            label="Selling Price (₦) *"
            placeholder="0.00"
            value={sellingPrice}
            onChangeText={setSellingPrice}
            keyboardType="decimal-pad"
            error={errors.sellingPrice}
          />
          <Input
            label="Cost Price (₦)"
            placeholder="0.00 (internal, not shown to customers)"
            value={costPrice}
            onChangeText={setCostPrice}
            keyboardType="decimal-pad"
            error={errors.costPrice}
          />
        </View>

        {/* Inventory */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <Input
            label="Initial Stock Quantity"
            placeholder="0"
            value={initialStock}
            onChangeText={setInitialStock}
            keyboardType="number-pad"
            error={errors.initialStock}
          />
          <Input
            label="Minimum Order Quantity"
            placeholder="1"
            value={minOrderQty}
            onChangeText={setMinOrderQty}
            keyboardType="number-pad"
          />
        </View>

        {/* Category */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.chipRow}>
              {categories.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.chip, categoryId === cat.id && styles.chipActive]}
                  onPress={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                >
                  <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Prescription toggle */}
        <View style={styles.section}>
          <Pressable
            style={styles.toggleRow}
            onPress={() => setRequiresPrescription(v => !v)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Requires Prescription</Text>
              <Text style={styles.toggleSub}>Customers will be warned before adding to cart</Text>
            </View>
            <View style={[styles.toggleWrap, requiresPrescription && styles.toggleWrapOn]}>
              <View style={[styles.toggleKnob, requiresPrescription && styles.toggleKnobOn]} />
            </View>
          </Pressable>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          {STATUS_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={[styles.statusOption, status === opt.value && { borderColor: opt.color, backgroundColor: opt.color + '08' }]}
              onPress={() => setStatus(opt.value)}
            >
              <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, status === opt.value && { color: opt.color }]}>{opt.label}</Text>
                <Text style={styles.statusDesc}>{opt.desc}</Text>
              </View>
              {status === opt.value && <Text style={{ fontSize: 16, color: opt.color }}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={createProduct.isPending}
          onPress={handleSubmit}
        >
          Create Product
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: 20, gap: 4 },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.ink, marginBottom: 14 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.line },
  chipActive:    { borderColor: Colors.brand, backgroundColor: Colors.brand + '10' },
  chipText:      { fontSize: 13, color: Colors.ink3, fontWeight: '600' },
  chipTextActive:{ color: Colors.brand },

  toggleRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    borderRadius:    14,
    padding:         16,
    gap:             12,
    shadowColor:     '#000',
    shadowOpacity:   0.04,
    shadowRadius:    6,
    elevation:       1,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: Colors.ink },
  toggleSub:   { fontSize: 12, color: Colors.ink4, marginTop: 2 },
  toggleWrap: {
    width:           48,
    height:          28,
    borderRadius:    14,
    backgroundColor: Colors.line,
    padding:         2,
    justifyContent:  'center',
  },
  toggleWrapOn: { backgroundColor: Colors.success },
  toggleKnob: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: Colors.white,
    shadowColor:     '#000',
    shadowOpacity:   0.15,
    shadowRadius:    4,
    elevation:       2,
  },
  toggleKnobOn: { alignSelf: 'flex-end' },

  statusOption: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    borderRadius:    12,
    padding:         14,
    gap:             12,
    marginBottom:    8,
    borderWidth:     1.5,
    borderColor:     Colors.line,
    shadowColor:     '#000',
    shadowOpacity:   0.03,
    shadowRadius:    4,
    elevation:       1,
  },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 14, fontWeight: '700', color: Colors.ink },
  statusDesc:  { fontSize: 12, color: Colors.ink4, marginTop: 2 },

  footer: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    padding:         16,
    paddingTop:      12,
    backgroundColor: Colors.white,
    borderTopWidth:  1,
    borderTopColor:  Colors.line,
  },
});
