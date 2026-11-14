import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { loadToken, setLogoutListener } from '../lib/api';
import { colors } from '../lib/util';
import AuthScreen from '../components/AuthScreen';
import { getPref } from '../lib/prefs';

// The window behind every screen: dark, so nothing white shows through when the keyboard resizes the screen.
SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

type State = 'loading' | 'loggedOut' | 'loggedIn';

export default function RootLayout() {
  const [state, setState] = useState<State>('loading');
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    setLogoutListener(() => setState('loggedOut'));
    // App lock can be switched off in Settings; then the app opens straight to Home.
    Promise.all([loadToken(), getPref('lock')]).then(([t, lock]) => {
      setLocked(lock);
      setState(t ? 'loggedIn' : 'loggedOut');
    });
    // Re-lock whenever the app goes to the background (if the lock is on).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') getPref('lock').then((on) => on && setLocked(true));
    });
    return () => sub.remove();
  }, []);

  if (state === 'loading')
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );

  if (state === 'loggedOut') return <AuthScreen mode="login" onDone={() => { setLocked(false); setState('loggedIn'); }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="account" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="person" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="categories" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      {/* Overlay keeps the screens mounted, so an unfinished form survives a lock. */}
      {locked && <AuthScreen mode="unlock" onDone={() => setLocked(false)} />}
    </View>
  );
}
