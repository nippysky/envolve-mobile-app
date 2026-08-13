/**
 * Secure token storage using expo-secure-store.
 * All JWT tokens are stored encrypted in the device keychain / keystore.
 */

import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY  = 'ep_access';
const REFRESH_KEY = 'ep_refresh';
const USER_KEY    = 'ep_user';

export const TokenStorage = {
  async getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },

  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },

  async saveTokens(access: string, refresh: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY,  access),
      SecureStore.setItemAsync(REFRESH_KEY, refresh),
    ]);
  },

  async saveUser(user: object): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async getUser<T>(): Promise<T | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; }
    catch { return null; }
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
};


/**
 * Non-sensitive preferences.
 *
 * Kept separate from TokenStorage on purpose — the keychain is for secrets,
 * and writing flags there is both slower and semantically wrong. SecureStore
 * is still used as the backing store so there is one dependency rather than
 * pulling in AsyncStorage for a single boolean.
 */
export const Storage = {
  async get(key: string): Promise<string | null> {
    try { return await SecureStore.getItemAsync(`pref_${key}`); }
    catch { return null; }
  },

  async set(key: string, value: string): Promise<void> {
    try { await SecureStore.setItemAsync(`pref_${key}`, value); }
    catch { /* a failed preference write must never block navigation */ }
  },

  async remove(key: string): Promise<void> {
    try { await SecureStore.deleteItemAsync(`pref_${key}`); }
    catch { /* noop */ }
  },
};
