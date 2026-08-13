/**
 * Privacy Policy.
 *
 * Copy is the client's and is reproduced verbatim, with the same two factual
 * corrections applied in the Terms: the registered entity name and the
 * contact address.
 *
 * Presentation lives in `LegalScreen`; this file is just the content.
 */

import React from 'react';
import { LegalScreen, type LegalSection } from '@/components/shared/LegalScreen';

const PRIVACY: LegalSection[] = [
  {
    title: "1. Introduction",
    body: `Envolve Pharmaceuticals Limited ("Company", "we", "us") operates the EnvolveCare Plus mobile application. We are committed to protecting your personal information in accordance with:\\n\\n• Nigeria Data Protection Regulation (NDPR) 2019\\n• Nigeria Data Protection Act 2023\\n• Apple App Store privacy guidelines\\n• Google Play Store privacy requirements\\n\\nThis Privacy Policy explains what data we collect, why we collect it, and how we protect it.`,
  },
  {
    title: "2. Data We Collect",
    body: `We collect the following categories of personal data:\\n\\nAccount Data: Full name, email address, phone number, role, and password (stored as a bcrypt hash — never in plain text).\\n\\nOrder & Health Data: Prescription details, order history, delivery addresses, and payment records.\\n\\nDevice Data: Device model, OS version, IP address, push notification token, and app crash logs for diagnostics.\\n\\nLocation Data: Delivery address you provide. We do NOT continuously track your GPS location.\\n\\nUsage Data: Pages visited, features used, and session duration for improving the App.`,
  },
  {
    title: "3. How We Use Your Data",
    body: `We process your personal data for the following purposes:\\n\\n• To create and manage your account.\\n• To process and fulfil your orders, including prescription verification.\\n• To communicate order status, updates, and support replies.\\n• To send push notifications (you can opt out in device settings at any time).\\n• To comply with legal obligations (e.g., PCN regulations, FIRS tax records).\\n• To detect fraud and ensure platform security.\\n• To improve the App through anonymized analytics.\\n\\nWe do not sell your personal data to third parties.`,
  },
  {
    title: "4. Legal Basis for Processing",
    body: `We process your data under the following legal bases (NDPR Article 2.2):\\n\\n• Contract performance — necessary to deliver the services you requested.\\n• Legitimate interests — fraud prevention, security, and improving the App.\\n• Legal obligation — compliance with Nigerian law and pharmaceutical regulations.\\n• Consent — for marketing communications and non-essential analytics. You may withdraw consent at any time.`,
  },
  {
    title: "5. Data Sharing",
    body: `We share your data only as necessary:\\n\\n• Payment processors (e.g. Paystack) to handle transactions.\\n• Delivery partners to fulfil your orders.\\n• Cloud infrastructure providers (servers are located within Nigeria or in jurisdictions with adequate data protection).\\n• Regulatory authorities when required by law.\\n\\nAll third-party processors are bound by data processing agreements consistent with NDPR requirements.`,
  },
  {
    title: "6. Data Retention",
    body: `We retain your data for as long as your account is active or as required by law:\\n\\n• Account data: retained for 5 years after account closure (statutory requirement).\\n• Order records: 7 years (tax and regulatory compliance).\\n• Anonymized analytics: indefinitely.\\n\\nYou may request deletion of your account data by contacting info@envolvepharm.com.ng. Some data may be retained to fulfill legal obligations.`,
  },
  {
    title: "7. Your Rights",
    body: `Under the NDPR and applicable law, you have the right to:\\n\\n• Access — request a copy of your personal data.\\n• Rectification — correct inaccurate data.\\n• Erasure — request deletion ("right to be forgotten") subject to legal exceptions.\\n• Restriction — limit how we process your data.\\n• Portability — receive your data in a machine-readable format.\\n• Objection — object to processing based on legitimate interests.\\n• Withdraw consent — at any time for consent-based processing.\\n\\nTo exercise these rights, email: privacy@envolvepharm.com.ng. We will respond within 30 days.`,
  },
  {
    title: "8. Security",
    body: `We implement industry-standard security measures including:\\n\\n• TLS/HTTPS encryption for all data in transit.\\n• Encrypted storage for authentication tokens on your device (iOS Keychain / Android Keystore).\\n• Bcrypt password hashing.\\n• Role-based access controls.\\n• Regular security audits.\\n\\nNo method of transmission over the internet is 100% secure. We cannot guarantee absolute security but commit to industry best practices.`,
  },
  {
    title: "9. Children's Privacy",
    body: `The App is not directed at children under the age of 18. We do not knowingly collect personal data from anyone under 18.\\n\\nIf you believe we have inadvertently collected data from a minor, please contact us immediately and we will delete such data.`,
  },
  {
    title: "10. Push Notifications",
    body: `With your permission, we send push notifications for order updates, delivery status, and important account alerts.\\n\\nYou can manage notification preferences in:\\n• Your device Settings → Notifications → EnvolveCare Plus\\n• Within the App under Profile → Notifications\\n\\nDisabling notifications does not affect your ability to use the App.`,
  },
  {
    title: "11. Third-Party Links",
    body: `The App may contain links to external websites or services. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies.`,
  },
  {
    title: "12. Changes to This Policy",
    body: `We may update this Privacy Policy periodically. We will notify you of material changes via in-app notification or email at least 14 days before they take effect.\\n\\nContinued use of the App after the effective date constitutes acceptance of the updated policy.`,
  },
  {
    title: "13. Contact & Data Protection Officer",
    body: `For privacy-related enquiries or to exercise your rights:\\n\\nEnvolve Pharmaceuticals Limited\\nData Protection Officer\\nEmail: privacy@envolvepharm.com.ng\\nWebsite: www.envolvepharm.com.ng\\n\\nIf you are not satisfied with our response, you have the right to lodge a complaint with the Nigeria Data Protection Commission (NDPC) at ndpb.gov.ng.`,
  },
];

export default function PrivacyScreen() {
  return (
    <LegalScreen
      title="Privacy Policy"
      updated="7 August 2026"
      sections={PRIVACY}
    />
  );
}
