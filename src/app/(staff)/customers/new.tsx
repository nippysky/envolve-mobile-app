/**
 * Add Customer (Staff/Admin only)
 * POST /api/customers — fields match customerOnboardSchema exactly.
 * The backend sends an invitation email with OTP to the new customer.
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa',
  'Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger',
  'Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
  'FCT',
];

export default function AddCustomer() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();

  const [firstName,   setFirstName]   = useState('');
  const [middleName,  setMiddleName]  = useState('');
  const [lastName,    setLastName]    = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email,       setEmail]       = useState('');
  const [phone,       setPhone]       = useState('');
  const [address,     setAddress]     = useState('');
  const [city,        setCity]        = useState('');
  const [state,       setState]       = useState('');
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const createCustomer = useMutation({
    mutationFn: () =>
      api.post('/api/customers', {
        first_name:   firstName.trim(),
        middle_name:  middleName.trim() || undefined,
        last_name:    lastName.trim(),
        company_name: companyName.trim(),
        email:        email.trim().toLowerCase(),
        phone:        phone.trim(),
        address:      address.trim(),
        city:         city.trim(),
        state:        state.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-customers'] });
      toast.success('Customer added. An invitation email has been sent.', '✅ Customer Created');
      router.back();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.errors) {
        const fe: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(e.errors)) {
          fe[k] = Array.isArray(msgs) ? msgs[0] : String(msgs);
        }
        setErrors(fe);
      }
      toast.error(e instanceof ApiError ? e.message : 'Failed to create customer.');
    },
  });

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim())   errs.first_name   = 'First name is required.';
    if (!lastName.trim())    errs.last_name    = 'Last name is required.';
    if (!companyName.trim()) errs.company_name = 'Pharmacy / company name is required.';
    if (!email.trim())       errs.email        = 'Email is required.';
    if (!phone.trim())       errs.phone        = 'Phone number is required.';
    if (!address.trim())     errs.address      = 'Address is required.';
    if (!city.trim())        errs.city         = 'City is required.';
    if (!state.trim())       errs.state        = 'State is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    createCustomer.mutate();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Add Customer" back onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Personal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <Input label="First Name *"         placeholder="e.g. Adeola"           value={firstName}   onChangeText={setFirstName}   error={errors.first_name} />
          <Input label="Middle Name"          placeholder="Optional"               value={middleName}  onChangeText={setMiddleName} />
          <Input label="Last Name *"          placeholder="e.g. Adeyemi"          value={lastName}    onChangeText={setLastName}    error={errors.last_name} />
          <Input label="Email Address *"      placeholder="customer@example.com"  value={email}       onChangeText={setEmail}       error={errors.email}      keyboardType="email-address" autoCapitalize="none" />
          <Input label="Phone Number *"       placeholder="+234 800 000 0000"     value={phone}       onChangeText={setPhone}       error={errors.phone}      keyboardType="phone-pad" />
        </View>

        {/* Business */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pharmacy / Business</Text>
          <Input label="Pharmacy / Company Name *" placeholder="e.g. Envolve Pharm Ltd" value={companyName} onChangeText={setCompanyName} error={errors.company_name} />
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <Input label="Street Address *" placeholder="e.g. 12 Lagos Street, Ikeja" value={address} onChangeText={setAddress} error={errors.address} multiline numberOfLines={2} />
          <Input label="City *"  placeholder="e.g. Lagos"  value={city}  onChangeText={setCity}  error={errors.city} />

          {/* State picker — simple inline list */}
          <Text style={styles.fieldLabel}>State *</Text>
          <View style={styles.stateGrid}>
            {NIGERIAN_STATES.map(s => (
              <Pressable2
                key={s}
                selected={state === s}
                onPress={() => setState(s)}
                label={s}
              />
            ))}
          </View>
          {errors.state ? <Text style={styles.fieldError}>{errors.state}</Text> : null}
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            An invitation email with a one-time password (OTP) will be sent to the customer so they can verify their account and set up a password.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button variant="primary" size="lg" fullWidth loading={createCustomer.isPending} onPress={handleSubmit}>
          Add Customer & Send Invite
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Inline Pressable for state selection ─────────────────────────────────────
import { Pressable } from 'react-native';

function Pressable2({ selected, onPress, label }: { selected: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      style={[styles.stateChip, selected && styles.stateChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.stateChipText, selected && styles.stateChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: 20, gap: 4 },
  section:      { marginBottom: 24 },
  sectionTitle: { ...type.h3, color: Colors.ink, marginBottom: 14 },

  fieldLabel: { ...type.label, color: Colors.ink2, marginBottom: 8 },
  fieldError: { ...type.caption, color: Colors.danger, marginTop: 4 },

  stateGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stateChip:         { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.line },
  stateChipActive:   { borderColor: Colors.brand, backgroundColor: Colors.brandLight },
  stateChipText:     { ...type.btnSm, color: Colors.ink3 },
  stateChipTextActive: { color: Colors.brand },

  infoBox: {
    backgroundColor: Colors.brandLight,
    borderRadius:    14,
    padding:         14,
    marginBottom:    16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  infoText: { ...type.bodySm, color: Colors.brandDark, lineHeight: 20 },

  footer: {
    position:        'absolute',
    bottom:          0, left: 0, right: 0,
    padding:         16,
    paddingTop:      12,
    backgroundColor: Colors.white,
    borderTopWidth:  0.5,
    borderTopColor:  Colors.line,
  },
});
