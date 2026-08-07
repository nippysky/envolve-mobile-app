/**
 * Add Staff / Driver / Admin
 * POST /api/staff — fields match createSchema exactly.
 * The backend sends a verification email so the user can set their password.
 */

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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { type } from '@/constants/typography';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/lib/toast';

type RoleOption = 'STAFF' | 'DRIVER';

const ROLES: { value: RoleOption; label: string; desc: string; iconName: IconName; color: string }[] = [
  {
    value:    'STAFF',
    label:    'Staff',
    desc:     'Pharmacist, admin, or manager with portal access',
    iconName: 'customers',
    color:    Colors.brand,
  },
  {
    value:    'DRIVER',
    label:    'Driver',
    desc:     'Delivery driver with the EnvolveCare driver portal',
    iconName: 'truck',
    color:    Colors.warning,
  },
];

export default function AddTeamMember() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();

  const [firstName,    setFirstName]    = useState('');
  const [middleName,   setMiddleName]   = useState('');
  const [lastName,     setLastName]     = useState('');
  const [email,        setEmail]        = useState('');
  const [phone,        setPhone]        = useState('');
  const [gender,       setGender]       = useState('');
  const [department,   setDepartment]   = useState('');
  const [jobTitle,     setJobTitle]     = useState('');
  const [role,         setRole]         = useState<RoleOption>('STAFF');

  // Driver-specific
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType,  setVehicleType]  = useState('');
  const [region,       setRegion]       = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMember = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        first_name:  firstName.trim(),
        last_name:   lastName.trim(),
        email:       email.trim().toLowerCase(),
        role,
      };
      if (middleName.trim())  body.middle_name   = middleName.trim();
      if (phone.trim())       body.phone         = phone.trim();
      if (gender.trim())      body.gender        = gender.trim();
      if (department.trim())  body.department    = department.trim();
      if (jobTitle.trim())    body.job_title     = jobTitle.trim();
      if (role === 'DRIVER') {
        if (vehiclePlate.trim()) body.vehicle_plate = vehiclePlate.trim();
        if (vehicleType.trim())  body.vehicle_type  = vehicleType.trim();
        if (region.trim())       body.region        = region.trim();
      }
      return api.post('/api/staff', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-team'] });
      toast.success('Team member added. A verification email has been sent.', '✅ Member Added');
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
      toast.error(e instanceof ApiError ? e.message : 'Failed to add member.');
    },
  });

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.first_name = 'First name is required.';
    if (!lastName.trim())  errs.last_name  = 'Last name is required.';
    if (!email.trim())     errs.email      = 'Email is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    createMember.mutate();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Add Team Member" back onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Role selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => (
              <Pressable
                key={r.value}
                style={[styles.roleCard, role === r.value && { borderColor: r.color, backgroundColor: r.color + '08' }]}
                onPress={() => setRole(r.value)}
              >
                <View style={[styles.roleIcon, { backgroundColor: r.color + '18' }]}>
                  <Icon name={r.iconName} size={22} color={r.color} />
                </View>
                <Text style={[styles.roleLabel, role === r.value && { color: r.color }]}>{r.label}</Text>
                <Text style={styles.roleDesc}>{r.desc}</Text>
                {role === r.value && (
                  <View style={[styles.roleCheck, { backgroundColor: r.color }]}>
                    <Icon name="check" size={11} color={Colors.white} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Personal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <Input label="First Name *"   placeholder="e.g. Chukwuemeka" value={firstName}  onChangeText={setFirstName}  error={errors.first_name} />
          <Input label="Middle Name"    placeholder="Optional"          value={middleName} onChangeText={setMiddleName} />
          <Input label="Last Name *"    placeholder="e.g. Okonkwo"     value={lastName}   onChangeText={setLastName}   error={errors.last_name} />
          <Input label="Email Address *" placeholder="work@envolvepharma.com" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Phone Number"   placeholder="+234 800 000 0000" value={phone}      onChangeText={setPhone}      keyboardType="phone-pad" />
        </View>

        {/* Staff-specific */}
        {role === 'STAFF' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Details</Text>
            <Input label="Gender"     placeholder="e.g. Male / Female"    value={gender}     onChangeText={setGender} />
            <Input label="Department" placeholder="e.g. Procurement"       value={department} onChangeText={setDepartment} />
            <Input label="Job Title"  placeholder="e.g. Senior Pharmacist" value={jobTitle}   onChangeText={setJobTitle} />
          </View>
        )}

        {/* Driver-specific */}
        {role === 'DRIVER' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver Details</Text>
            <Input label="Vehicle Plate" placeholder="e.g. LAG-123-AA"   value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />
            <Input label="Vehicle Type"  placeholder="e.g. Motorcycle"   value={vehicleType}  onChangeText={setVehicleType} />
            <Input label="Region / Zone" placeholder="e.g. Lagos Island" value={region}       onChangeText={setRegion} />
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            A verification email will be sent to this address. The team member must click the link to verify and set their password before they can log in.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button variant="primary" size="lg" fullWidth loading={createMember.isPending} onPress={handleSubmit}>
          Add {role === 'DRIVER' ? 'Driver' : 'Staff Member'} & Send Invite
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: 20, gap: 4 },
  section:      { marginBottom: 24 },
  sectionTitle: { ...type.h3, color: Colors.ink, marginBottom: 14 },

  roleRow:  { flexDirection: 'row', gap: 12 },
  roleCard: {
    flex:            1,
    backgroundColor: Colors.white,
    borderRadius:    16,
    padding:         16,
    borderWidth:     2,
    borderColor:     Colors.line,
    gap:             6,
    position:        'relative',
  },
  roleIcon:  { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  roleLabel: { ...type.h4, color: Colors.ink },
  roleDesc:  { ...type.caption, color: Colors.ink4, lineHeight: 17 },
  roleCheck: {
    position:       'absolute',
    top:            10,
    right:          10,
    width:          20,
    height:         20,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },

  infoBox: {
    backgroundColor: Colors.tealLight,
    borderRadius:    14,
    padding:         14,
    marginBottom:    16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.teal,
  },
  infoText: { ...type.bodySm, color: Colors.teal, lineHeight: 20 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingTop: 12,
    backgroundColor: Colors.white, borderTopWidth: 0.5, borderTopColor: Colors.line,
  },
});
