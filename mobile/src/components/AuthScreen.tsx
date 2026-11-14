import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { login } from '../lib/api';
import { colors, heroGradient, OWNER_NAME } from '../lib/util';
import { Button } from './ui';
import { CranePond, type PondHandle } from './CranePond';
import { getPref } from '../lib/prefs';

// One screen for both cases:
//  - "login":  no saved session yet -> password only.
//  - "unlock": session saved -> fingerprint (auto-prompted) or password.
export default function AuthScreen({ mode, onDone }: { mode: 'login' | 'unlock'; onDone: () => void }) {
  const [usePassword, setUsePassword] = useState(mode === 'login');
  const [biometricReady, setBiometricReady] = useState(false);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fingerprint = async () => {
    setError('');
    // The native module answers "app_cancel" to every new request while it believes an older
    // prompt is still open, which happens when a prompt silently failed to show. So always
    // clear any leftover prompt first, give Android a moment to tear it down, then ask.
    await LocalAuthentication.cancelAuthenticate().catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Expense Tracker', promptSubtitle: 'Use your fingerprint or phone PIN' });
    if (r.success) return onDone();
    if (r.error === 'user_cancel' || r.error === 'system_cancel') return;
    if (r.error === 'lockout') return setError('Too many attempts. Use your password.');
    setError(`Could not unlock (${r.error}). Tap the fingerprint to try again.`);
  };

  useEffect(() => {
    if (mode !== 'unlock') return;
    let sub: { remove: () => void } | undefined;
    (async () => {
      // Fingerprint can be switched off in Settings; then only the password unlocks the app.
      const ready = (await getPref('fingerprint')) && (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setBiometricReady(ready);
      if (!ready) return setUsePassword(true);
      // Auto-prompt only once the app is fully in the foreground; Android drops prompts shown earlier.
      if (AppState.currentState === 'active') fingerprint();
      else sub = AppState.addEventListener('change', (st) => { if (st === 'active') { sub?.remove(); fingerprint(); } });
    })();
    return () => sub?.remove();
  }, []);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await login(password);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const pond = useRef<PondHandle>(null);

  return (
    // Cranes fly behind and everything sits straight on the background (no panel). Touching anywhere nudges the birds.
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} onTouchStart={(e) => pond.current?.scatter(e.nativeEvent.pageX, e.nativeEvent.pageY)}>
      <CranePond ref={pond} />
      <KeyboardAvoidingView style={styles.wrap} behavior="padding">
      <LinearGradient colors={heroGradient} style={styles.appIcon}>
        <Ionicons name="wallet" size={34} color={colors.onAccent} />
      </LinearGradient>
      <Text style={styles.title}>{mode === 'login' ? 'Expense Tracker' : `Welcome back, ${OWNER_NAME}`}</Text>
      <Text style={styles.subtitle}>
        {usePassword ? 'Enter your password to continue' : 'Unlock with your fingerprint or phone PIN'}
      </Text>

      <View>
      {!usePassword ? (
        <View style={{ gap: 14 }}>
          <Button label="Unlock" onPress={fingerprint} />
          {!!error && <Text style={styles.error}>{error}</Text>}
                    <Pressable onPress={() => { setError(''); setUsePassword(true); }} style={({ pressed }) => [styles.switchRow, pressed && { opacity: 0.6 }]} hitSlop={12}>
            <Text style={styles.link}>Use password instead</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={styles.field}>
            <Ionicons name="lock-closed" size={18} color={colors.muted} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={12}>
              <Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={colors.muted} />
            </Pressable>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {busy ? <ActivityIndicator color={colors.accent} style={{ padding: 15 }} /> : <Button label="Continue" onPress={submit} disabled={!password} />}
          {mode === 'unlock' && biometricReady && (
            <>
                            <Pressable onPress={() => { setError(''); setUsePassword(false); fingerprint(); }} style={({ pressed }) => [styles.switchRow, pressed && { opacity: 0.6 }]} hitSlop={12}>
                <Text style={styles.link}>Use fingerprint instead</Text>
              </Pressable>
            </>
          )}
          {mode === 'login' && <Text style={styles.hint}>After this, you can unlock with your fingerprint.</Text>}
        </View>
      )}
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  appIcon: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 27, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 18, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: 15 },
  error: { color: colors.red, textAlign: 'center', fontSize: 14 },
  link: { color: colors.accent, fontSize: 15.5, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6 },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 13 },
});
