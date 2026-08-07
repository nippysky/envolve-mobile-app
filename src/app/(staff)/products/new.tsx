/**
 * Add Product screen.
 *
 * Image upload: uses expo-image-picker (run `npx expo install expo-image-picker`
 * if not yet installed, or it will be fetched automatically on EAS build).
 */

import React, { useState } from 'react';
import {
  Alert,
  Image,
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
import { type } from '@/constants/typography';
import { Icon } from '@/components/ui/Icon';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api-client';
import { API_BASE, MOBILE_HEADERS } from '@/constants/api';
import { TokenStorage } from '@/lib/storage';
import { toast } from '@/lib/toast';

// Dynamic import for expo-image-picker.
// Run `npx expo install expo-image-picker` to enable this feature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ImagePicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

interface Category {
  id:   number;
  name: string;
  slug: string;
}
interface CategoriesResponse { categories: Category[] }

type ProductStatus = 'ACTIVE' | 'DRAFT' | 'DISCONTINUED';

const STATUS_OPTIONS: { value: ProductStatus; label: string; desc: string; color: string }[] = [
  { value: 'ACTIVE',       label: 'Active',       desc: 'Visible in catalog — customers can order',       color: Colors.success },
  { value: 'DRAFT',        label: 'Draft',        desc: 'Hidden from catalog — not orderable yet',        color: Colors.ink3 },
  { value: 'DISCONTINUED', label: 'Discontinued', desc: 'No longer sold — kept for order history',        color: Colors.danger },
];

export default function AddProduct() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();

  // Form fields
  const [brandName,            setBrandName]            = useState('');
  const [genericName,          setGenericName]          = useState('');
  const [strength,             setStrength]             = useState('');
  const [manufacturer,         setManufacturer]         = useState('');
  const [costPrice,            setCostPrice]            = useState('');
  const [sellingPrice,         setSellingPrice]         = useState('');
  const [initialStock,         setInitialStock]         = useState('');
  const [minOrderQty,          setMinOrderQty]          = useState('1');
  const [requiresPrescription, setRequiresPrescription] = useState(false);
  const [categoryId,           setCategoryId]           = useState<number | null>(null);
  const [status,               setStatus]               = useState<ProductStatus>('ACTIVE');
  const [errors,               setErrors]               = useState<Record<string, string>>({});

  // Image
  const [imageUri,   setImageUri]   = useState<string | null>(null);
  const [imageFile,  setImageFile]  = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const { data: catData } = useQuery({
    queryKey: ['product-categories'],
    queryFn:  () => api.get<CategoriesResponse>('/api/products/categories'),
  });
  const categories = catData?.categories ?? [];

  // ── Image picker ──────────────────────────────────────────────────────────
  async function pickImage() {
    if (!ImagePicker) {
      Alert.alert(
        'Package required',
        'Run `npx expo install expo-image-picker` to enable image upload.',
      );
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const ext  = asset.uri.split('.').pop() ?? 'jpg';
      const name = `product-${Date.now()}.${ext}`;
      setImageFile({ uri: asset.uri, name, type: `image/${ext}` });
    }
  }

  async function uploadImage(uri: string, name: string, mimeType: string): Promise<string> {
    const token = await TokenStorage.getAccess();
    const form  = new FormData();
    form.append('file', { uri, name, type: mimeType } as any);

    const res = await fetch(`${API_BASE}/api/products/upload-image`, {
      method:  'POST',
      headers: {
        ...MOBILE_HEADERS,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'multipart/form-data',
      },
      body: form,
    });
    if (!res.ok) throw new Error('Image upload failed');
    const json = await res.json();
    return json.data?.url ?? json.url ?? '';
  }

  // ── Create product ────────────────────────────────────────────────────────
  const createProduct = useMutation({
    mutationFn: async () => {
      let imageUrl = uploadedUrl;

      if (imageFile && !uploadedUrl) {
        setUploading(true);
        try {
          imageUrl = await uploadImage(imageFile.uri, imageFile.name, imageFile.type);
          setUploadedUrl(imageUrl);
        } finally {
          setUploading(false);
        }
      }

      const body: Record<string, unknown> = {
        brand_name:             brandName.trim(),
        generic_name:           genericName.trim()  || undefined,
        product_strength:       strength.trim()     || undefined,
        manufacturer:           manufacturer.trim() || undefined,
        selling_price:          parseFloat(sellingPrice),
        status,
        requires_prescription:  requiresPrescription,
      };
      if (costPrice)    body.cost_price    = parseFloat(costPrice);
      if (initialStock) body.initial_stock = parseInt(initialStock, 10);
      if (minOrderQty)  body.minimum_order = parseInt(minOrderQty, 10);
      if (categoryId)   body.category_id   = categoryId;
      if (imageUrl)     body.image_url     = imageUrl;

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
    if (!brandName.trim())   errs.brandName    = 'Brand name is required.';
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

  const isBusy = uploading || createProduct.isPending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Add Product" back onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Product image */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Photo</Text>
          <Pressable style={styles.imagePicker} onPress={pickImage}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <View style={styles.changeOverlay}>
                  <Icon name="edit" size={18} color={Colors.white} />
                  <Text style={styles.changeText}>Change</Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={styles.imagePlaceholderIcon}>
                  <Icon name="image" size={28} color={Colors.ink4} />
                </View>
                <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                <Text style={styles.imagePlaceholderSub}>JPG or PNG · Square crop recommended</Text>
              </View>
            )}
          </Pressable>
          {uploading && (
            <View style={styles.uploadingRow}>
              <Icon name="upload" size={14} color={Colors.brand} />
              <Text style={styles.uploadingText}>Uploading image…</Text>
            </View>
          )}
        </View>

        {/* Basic info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Info</Text>
          <Input label="Brand Name *"       placeholder="e.g. Panadol Extra"            value={brandName}    onChangeText={setBrandName}    error={errors.brandName} />
          <Input label="Generic / Active Ingredient" placeholder="e.g. Paracetamol + Caffeine" value={genericName}  onChangeText={setGenericName} />
          <Input label="Strength / Dosage"  placeholder="e.g. 500mg/65mg"               value={strength}     onChangeText={setStrength} />
          <Input label="Manufacturer"       placeholder="e.g. GlaxoSmithKline"          value={manufacturer} onChangeText={setManufacturer} />
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <Input label="Selling Price (₦) *"           placeholder="0.00"                           value={sellingPrice} onChangeText={setSellingPrice} keyboardType="decimal-pad" error={errors.sellingPrice} />
          <Input label="Cost Price (₦)"                placeholder="0.00 — internal only"            value={costPrice}    onChangeText={setCostPrice}    keyboardType="decimal-pad" error={errors.costPrice} />
        </View>

        {/* Inventory */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <Input label="Initial Stock Quantity" placeholder="0"  value={initialStock} onChangeText={setInitialStock} keyboardType="number-pad" error={errors.initialStock} />
          <Input label="Minimum Order Quantity" placeholder="1"  value={minOrderQty}  onChangeText={setMinOrderQty}  keyboardType="number-pad" />
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
          <Pressable style={styles.toggleRow} onPress={() => setRequiresPrescription(v => !v)}>
            <View style={[styles.toggleIconWrap, { backgroundColor: requiresPrescription ? Colors.warning + '20' : Colors.bgMuted }]}>
              <Icon name="clipboard" size={18} color={requiresPrescription ? Colors.warning : Colors.ink4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Requires Prescription</Text>
              <Text style={styles.toggleSub}>Customers are warned before adding to cart</Text>
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
              {status === opt.value && <Icon name="check-circle" size={18} color={opt.color} />}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button variant="primary" size="lg" fullWidth loading={isBusy} onPress={handleSubmit}>
          {uploading ? 'Uploading image…' : 'Create Product'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: 20, gap: 4 },
  section:      { marginBottom: 24 },
  sectionTitle: { ...type.h3, color: Colors.ink, marginBottom: 14 },

  imagePicker: {
    height:          180,
    borderRadius:    16,
    overflow:        'hidden',
    backgroundColor: Colors.white,
    borderWidth:     1.5,
    borderColor:     Colors.line,
    borderStyle:     'dashed',
  },
  imagePreview:     { width: '100%', height: '100%' },
  changeOverlay: {
    position:       'absolute',
    bottom:         12,
    right:          12,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius:   10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  changeText:  { ...type.label, color: Colors.white },
  imagePlaceholder: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
  },
  imagePlaceholderIcon: {
    width:           64,
    height:          64,
    borderRadius:    18,
    backgroundColor: Colors.bgMuted,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  imagePlaceholderText: { ...type.bodyMed, color: Colors.ink3 },
  imagePlaceholderSub:  { ...type.caption, color: Colors.ink4 },
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  uploadingText: { ...type.caption, color: Colors.brand },

  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.line },
  chipActive:     { borderColor: Colors.brand, backgroundColor: Colors.brandLight },
  chipText:       { ...type.label, color: Colors.ink3 },
  chipTextActive: { color: Colors.brand },

  toggleRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    borderRadius:    16,
    padding:         16,
    gap:             14,
    borderWidth:     1,
    borderColor:     Colors.line,
  },
  toggleIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggleLabel:    { ...type.bodyMed, color: Colors.ink },
  toggleSub:      { ...type.caption, color: Colors.ink4, marginTop: 2 },
  toggleWrap:     { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.line, padding: 2, justifyContent: 'center' },
  toggleWrapOn:   { backgroundColor: Colors.success },
  toggleKnob:     { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.white, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  toggleKnobOn:   { alignSelf: 'flex-end' },

  statusOption: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    borderRadius:    14,
    padding:         14,
    gap:             12,
    marginBottom:    8,
    borderWidth:     1.5,
    borderColor:     Colors.line,
  },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { ...type.bodyMed, color: Colors.ink },
  statusDesc:  { ...type.caption, color: Colors.ink4, marginTop: 2 },

  footer: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    padding:         16,
    paddingTop:      12,
    backgroundColor: Colors.white,
    borderTopWidth:  0.5,
    borderTopColor:  Colors.line,
  },
});
