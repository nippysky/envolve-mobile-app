/**
 * Terms & Conditions.
 *
 * Copy is the client's and is reproduced verbatim, with two factual
 * corrections: the registered entity is "Envolve Pharmaceuticals Limited"
 * (the old text said "Evolve Pharma Limited"), and the contact address is
 * info@envolvepharm.com.ng — support@ was never a real mailbox.
 *
 * Presentation lives in `LegalScreen`; this file is just the content.
 */

import React from 'react';
import { LegalScreen, type LegalSection } from '@/components/shared/LegalScreen';

const TERMS: LegalSection[] = [
  {
    title: "1. Acceptance of Terms",
    body: `By downloading, installing, or using the EnvolveCare Plus mobile application ("App"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree, do not use the App.\\n\\nThese Terms form a legally binding agreement between you and Envolve Pharmaceuticals Limited ("Company", "we", "us", or "our"). We reserve the right to update these Terms at any time. Continued use of the App after changes are posted constitutes acceptance.`,
  },
  {
    title: "2. Eligibility",
    body: `You must be at least 18 years old to use this App. By using the App you represent that you are of legal age and have the legal capacity to enter into a binding contract in your jurisdiction.\\n\\nIf you are using the App on behalf of an organization, you represent that you have authority to bind that organization to these Terms.`,
  },
  {
    title: "3. Description of Services",
    body: `EnvolveCare Plus provides a platform for:\\n\\n• Customers: browsing, ordering, and tracking pharmaceutical products and health supplies.\\n• Pharmacists & Staff: managing orders, inventory, and customer interactions.\\n• Delivery Drivers: receiving and fulfilling delivery assignments.\\n\\nWe do not provide medical advice. Content in the App is for informational purposes only. Always consult a qualified healthcare professional before making health decisions.`,
  },
  {
    title: "4. Account Registration",
    body: `You must create an account to access most features. You are responsible for:\\n\\n• Providing accurate, complete, and current information.\\n• Maintaining the confidentiality of your login credentials.\\n• All activity that occurs under your account.\\n\\nNotify us immediately at info@envolvepharm.com.ng if you suspect unauthorized access to your account. We will not be liable for losses resulting from unauthorized use of your credentials.`,
  },
  {
    title: "5. Prescription Medicines",
    body: `The App may display prescription medicines. To order prescription products:\\n\\n• A valid prescription issued by a licensed practitioner is required.\\n• Our pharmacists will verify prescriptions before dispensing.\\n• Any misrepresentation regarding prescriptions may result in account suspension and may be reported to relevant regulatory authorities.\\n\\nWe comply with the Pharmacists Council of Nigeria (PCN) and all applicable Nigerian drug laws.`,
  },
  {
    title: "6. Orders and Payments",
    body: `All orders are subject to availability and acceptance. We reserve the right to cancel or refuse any order.\\n\\nPayments are processed via secure third-party payment gateways (e.g. Paystack). We do not store your full payment card details on our servers.\\n\\nPrices are in Nigerian Naira (NGN) unless stated otherwise and are subject to change without notice. All sales are final unless the product is defective, damaged, or incorrectly supplied.`,
  },
  {
    title: "7. Delivery",
    body: `Estimated delivery times are provided in good faith and may vary due to factors outside our control (traffic, weather, public holidays). We are not liable for delays beyond our reasonable control.\\n\\nRisk of loss passes to you upon successful delivery to the address you specified.`,
  },
  {
    title: "8. Prohibited Conduct",
    body: `You agree not to:\\n\\n• Use the App for any unlawful purpose.\\n• Attempt to gain unauthorized access to any part of the App or its infrastructure.\\n• Upload false, misleading, or fraudulent content.\\n• Resell or redistribute products purchased for commercial purposes without our written consent.\\n• Reverse-engineer, decompile, or disassemble any part of the App.\\n• Harass, threaten, or harm other users or staff.`,
  },
  {
    title: "9. Intellectual Property",
    body: `All content, trademarks, logos, and software in the App are owned by or licensed to the Company. You are granted a limited, non-exclusive, non-transferable license to use the App for personal, non-commercial purposes.\\n\\nYou may not copy, modify, distribute, sell, or lease any part of the App without our prior written permission.`,
  },
  {
    title: "10. Disclaimer of Warranties",
    body: `The App is provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, or non-infringement.\\n\\nWe do not warrant that the App will be uninterrupted, error-free, or free of viruses or other harmful components.`,
  },
  {
    title: "11. Limitation of Liability",
    body: `To the maximum extent permitted by applicable law, the Company shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the App.\\n\\nOur total aggregate liability to you for any claim arising under these Terms shall not exceed the amount you paid us in the 3 months preceding the claim.`,
  },
  {
    title: "12. Indemnification",
    body: `You agree to indemnify and hold harmless the Company and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from:\\n\\n• Your use of the App.\\n• Your violation of these Terms.\\n• Your violation of any third-party rights.`,
  },
  {
    title: "13. Termination",
    body: `We may suspend or terminate your account at any time for violations of these Terms or for any other reason with or without notice. Upon termination, your right to use the App ceases immediately.\\n\\nYou may delete your account at any time by contacting info@envolvepharm.com.ng.`,
  },
  {
    title: "14. Governing Law",
    body: `These Terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes shall be submitted to the exclusive jurisdiction of courts in Lagos State, Nigeria.`,
  },
  {
    title: "15. Contact Us",
    body: `If you have questions about these Terms, contact us:\\n\\nEnvolve Pharmaceuticals Limited\\nEmail: info@envolvepharm.com.ng\\nWebsite: www.envolvepharm.com.ng`,
  },
];

export default function TermsScreen() {
  return (
    <LegalScreen
      title="Terms & Conditions"
      updated="7 August 2026"
      sections={TERMS}
    />
  );
}
