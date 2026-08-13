import { Linking, Platform } from 'react-native';

/**
 * Open the platform's maps app at an address.
 *
 * Uses the native scheme first so the driver lands in Apple Maps or Google
 * Maps with navigation ready, rather than a web page they'd then have to hand
 * off themselves. Falls back to the web URL if no maps app handles the scheme —
 * which happens on Android devices shipped without Google Play services.
 */
export function openDirections(address: string): void {
  const q = encodeURIComponent(address);

  const nativeUrl = Platform.select({
    ios:     `maps://?q=${q}`,
    android: `geo:0,0?q=${q}`,
    default: `https://maps.google.com/?q=${q}`,
  })!;

  void Linking.openURL(nativeUrl).catch(() => {
    void Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {
      // Nothing on the device can show a map. Silent rather than a toast —
      // the address is already on screen and readable.
    });
  });
}
