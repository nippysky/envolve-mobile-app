import { Linking, Platform } from 'react-native';
import { toast } from '@/lib/toast';

/**
 * Phone, email and SMS deep links.
 *
 * `Linking.openURL` rejects silently in a few real situations — an iPad or
 * simulator with no dialler, an Android build with no mail client installed,
 * a malformed number. Left unhandled that's a button that does nothing, which
 * is the worst possible outcome for a rep standing in front of a customer.
 * Every helper here reports failure rather than swallowing it.
 *
 * ## Why `telprompt` isn't used on iOS
 *
 * `telprompt:` asks "call this number?" before dialling, which sounds safer.
 * It's undocumented, has been rejected in App Store review, and behaves
 * inconsistently across iOS versions. `tel:` already shows the system
 * confirmation sheet on iPhone, so the extra scheme buys nothing.
 */

/**
 * Strip everything a dialler can't use.
 *
 * Keeps a leading `+` for international numbers and digits. Spaces, brackets
 * and dashes are how people write numbers, not how `tel:` accepts them —
 * "0805 513 6726" produces a malformed URL that fails on some Android
 * diallers.
 */
export function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus    = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

async function open(url: string, failure: string): Promise<boolean> {
  try {
    // `canOpenURL` is advisory — on Android it can return false for a scheme
    // that would actually work, because of package-visibility rules. So the
    // attempt happens regardless and only a thrown error counts as failure.
    await Linking.openURL(url);
    return true;
  } catch {
    toast.error(failure, 'Couldn’t open');
    return false;
  }
}

/** Dial a number. Returns false and toasts if no dialler handled it. */
export function callNumber(phone: string | null | undefined): Promise<boolean> {
  const n = phone ? normalisePhone(phone) : '';
  if (!n) {
    toast.error('There’s no phone number on file for this contact.', 'No number');
    return Promise.resolve(false);
  }
  return open(`tel:${n}`, `No dialler is available for ${phone}.`);
}

/** Open a new SMS to a number, optionally pre-filled. */
export function textNumber(
  phone: string | null | undefined,
  body?: string,
): Promise<boolean> {
  const n = phone ? normalisePhone(phone) : '';
  if (!n) {
    toast.error('There’s no phone number on file for this contact.', 'No number');
    return Promise.resolve(false);
  }
  // iOS separates the body with `&`, Android with `?` — getting this wrong
  // opens the composer with the body as part of the recipient.
  const sep  = Platform.OS === 'ios' ? '&' : '?';
  const url  = body ? `sms:${n}${sep}body=${encodeURIComponent(body)}` : `sms:${n}`;
  return open(url, 'No messaging app is available.');
}

/** Compose an email, optionally with a subject and body. */
export function emailAddress(
  email: string | null | undefined,
  opts: { subject?: string; body?: string } = {},
): Promise<boolean> {
  const addr = email?.trim();
  if (!addr) {
    toast.error('There’s no email address on file for this contact.', 'No email');
    return Promise.resolve(false);
  }

  const params = new URLSearchParams();
  if (opts.subject) params.set('subject', opts.subject);
  if (opts.body)    params.set('body', opts.body);
  const query = params.toString();

  return open(
    `mailto:${addr}${query ? `?${query}` : ''}`,
    `No mail app is set up to send to ${addr}.`,
  );
}
