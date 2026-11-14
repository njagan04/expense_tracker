import * as SecureStore from 'expo-secure-store';

// On/off settings saved on this phone. All default to on.
export const PREFS = {
  cranes: 'pref_cranes_home', // crane animation behind Home
  lock: 'pref_app_lock', // lock the app when it is opened (off = straight to Home)
  fingerprint: 'pref_fingerprint', // unlock with fingerprint (off = password only)
} as const;

export type Pref = keyof typeof PREFS;

export const getPref = (p: Pref) => SecureStore.getItemAsync(PREFS[p]).then((v) => v !== '0', () => true);
export const setPref = (p: Pref, on: boolean) => SecureStore.setItemAsync(PREFS[p], on ? '1' : '0').catch(() => {});
