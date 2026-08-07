import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

export default function Terms() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.heading}>Terms & Conditions</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last updated: 7 August 2026</Text>

        <Section title="1. Acceptance of Terms">
          {`By downloading, installing, or using the EnvolveCare Plus mobile application ("App"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree, do not use the App.\n\nThese Terms form a legally binding agreement between you and Evolve Pharma Limited ("Company", "we", "us", or "our"). We reserve the right to update these Terms at any time. Continued use of the App after changes are posted constitutes acceptance.`}
        </Section>

        <Section title="2. Eligibility">
          {`You must be at least 18 years old to use this App. By using the App you represent that you are of legal age and have the legal capacity to enter into a binding contract in your jurisdiction.\n\nIf you are using the App on behalf of an organization, you represent that you have authority to bind that organization to these Terms.`}
        </Section>

        <Section title="3. Description of Services">
          {`EnvolveCare Plus provides a platform for:\n\n• Customers: browsing, ordering, and tracking pharmaceutical products and health supplies.\n• Pharmacists & Staff: managing orders, inventory, and customer interactions.\n• Delivery Drivers: receiving and fulfilling delivery assignments.\n• Administrators: managing users, roles, and platform settings.\n\nWe do not provide medical advice. Content in the App is for informational purposes only. Always consult a qualified healthcare professional before making health decisions.`}
        </Section>

        <Section title="4. Account Registration">
          {`You must create an account to access most features. You are responsible for:\n\n• Providing accurate, complete, and current information.\n• Maintaining the confidentiality of your login credentials.\n• All activity that occurs under your account.\n\nNotify us immediately at support@envolvepharm.com.ng if you suspect unauthorized access to your account. We will not be liable for losses resulting from unauthorized use of your credentials.`}
        </Section>

        <Section title="5. Prescription Medicines">
          {`The App may display prescription medicines. To order prescription products:\n\n• A valid prescription issued by a licensed practitioner is required.\n• Our pharmacists will verify prescriptions before dispensing.\n• Any misrepresentation regarding prescriptions may result in account suspension and may be reported to relevant regulatory authorities.\n\nWe comply with the Pharmacists Council of Nigeria (PCN) and all applicable Nigerian drug laws.`}
        </Section>

        <Section title="6. Orders and Payments">
          {`All orders are subject to availability and acceptance. We reserve the right to cancel or refuse any order.\n\nPayments are processed via secure third-party payment gateways (e.g. Paystack). We do not store your full payment card details on our servers.\n\nPrices are in Nigerian Naira (NGN) unless stated otherwise and are subject to change without notice. All sales are final unless the product is defective, damaged, or incorrectly supplied.`}
        </Section>

        <Section title="7. Delivery">
          {`Estimated delivery times are provided in good faith and may vary due to factors outside our control (traffic, weather, public holidays). We are not liable for delays beyond our reasonable control.\n\nRisk of loss passes to you upon successful delivery to the address you specified.`}
        </Section>

        <Section title="8. Prohibited Conduct">
          {`You agree not to:\n\n• Use the App for any unlawful purpose.\n• Attempt to gain unauthorized access to any part of the App or its infrastructure.\n• Upload false, misleading, or fraudulent content.\n• Resell or redistribute products purchased for commercial purposes without our written consent.\n• Reverse-engineer, decompile, or disassemble any part of the App.\n• Harass, threaten, or harm other users or staff.`}
        </Section>

        <Section title="9. Intellectual Property">
          {`All content, trademarks, logos, and software in the App are owned by or licensed to the Company. You are granted a limited, non-exclusive, non-transferable license to use the App for personal, non-commercial purposes.\n\nYou may not copy, modify, distribute, sell, or lease any part of the App without our prior written permission.`}
        </Section>

        <Section title="10. Disclaimer of Warranties">
          {`The App is provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, or non-infringement.\n\nWe do not warrant that the App will be uninterrupted, error-free, or free of viruses or other harmful components.`}
        </Section>

        <Section title="11. Limitation of Liability">
          {`To the maximum extent permitted by applicable law, the Company shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the App.\n\nOur total aggregate liability to you for any claim arising under these Terms shall not exceed the amount you paid us in the 3 months preceding the claim.`}
        </Section>

        <Section title="12. Indemnification">
          {`You agree to indemnify and hold harmless the Company and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from:\n\n• Your use of the App.\n• Your violation of these Terms.\n• Your violation of any third-party rights.`}
        </Section>

        <Section title="13. Termination">
          {`We may suspend or terminate your account at any time for violations of these Terms or for any other reason with or without notice. Upon termination, your right to use the App ceases immediately.\n\nYou may delete your account at any time by contacting support@envolvepharm.com.ng.`}
        </Section>

        <Section title="14. Governing Law">
          {`These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes shall be submitted to the exclusive jurisdiction of courts in Lagos State, Nigeria.`}
        </Section>

        <Section title="15. Contact Us">
          {`If you have questions about these Terms, contact us:\n\nEvolve Pharma Limited\nEmail: support@envolvepharm.com.ng\nWebsite: www.envolvepharm.com.ng`}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <Text style={sec.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  close:   { fontSize: 18, color: Colors.ink3, fontWeight: '600' },
  heading: { fontSize: 17, fontWeight: '700', color: Colors.ink },
  updated: { fontSize: 12, color: Colors.ink4, marginBottom: 20 },
  body:    { paddingHorizontal: 20, paddingTop: 20 },
});

const sec = StyleSheet.create({
  wrap:  { marginBottom: 24 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.ink, marginBottom: 8 },
  body:  { fontSize: 14, color: Colors.ink2, lineHeight: 22 },
});
