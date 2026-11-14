import * as SecureStore from 'expo-secure-store';

// On/off settings saved on this phone. All default to on.
export const PREFS = {
  cranes: 'pref_cranes_home', // crane animation behind Home
  lock: 'pref_app_lock', // fingerprint/password when the app opens (off = straight to Home)
} as const;

export type Pref = keyof typeof PREFS;

export const getPref = (p: Pref) => SecureStore.getItemAsync(PREFS[p]).then((v) => v !== '0', () => true);
export const setPref = (p: Pref, on: boolean) => SecureStore.setItemAsync(PREFS[p], on ? '1' : '0').catch(() => {});
