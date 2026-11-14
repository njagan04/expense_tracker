import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { lastUsername, login, userName } from '../lib/api';
import { colors, heroGradient } from '../lib/util';
import { Button } from './ui';
import { CranePond, type PondHandle } from './CranePond';

// One screen for both cases:
//  - "login":  no saved session yet -> username + password, or create an account with the invite code.
//  - "unlock": session saved -> fingerprint (auto-prompted) or password.
export default function AuthScreen({ mode, onDone }: { mode: 'login' | 'unlock'; onDone: () => void }) {
  const [usePassword, setUsePassword] = useState(mode === 'login');
  const [biometricReady, setBiometricReady] = useState(false);
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', code: '' });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
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
      // Phones without a fingerprint set up unlock with the password.
      const ready = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setBiometricReady(ready);
      if (!ready) return setUsePassword(true);
      // Auto-prompt only once the app is fully in the foreground; Android drops prompts shown earlier.
      if (AppState.currentState === 'active') fingerprint();
      else sub = AppState.addEventListener('change', (st) => { if (st === 'active') { sub?.remove(); fingerprint(); } });
    })();
    return () => sub?.remove();
  }, []);

  const filled = !!password && (mode === 'unlock' || (!!form.username && (!signup || (!!form.name && !!form.code))));
  const submit = async () => {
    if (!filled || busy) return;
    setBusy(true);
    setError('');
    try {
      // Unlocking with the password re-logs in as the same user.
      if (signup) await login('/signup', { ...form, password });
      else await login('/login', { username: mode === 'unlock' ? lastUsername() : form.username, password });
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
      <Text style={styles.title}>{mode === 'login' ? (signup ? 'Create account' : 'Expense Tracker') : `Welcome back, ${userName()}`}</Text>
      <Text style={styles.subtitle}>
        {signup ? 'Ask the app owner for the invite code' : usePassword ? 'Enter your password to continue' : 'Unlock with your fingerprint or phone PIN'}
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
          {signup && <Field icon="happy-outline" placeholder="Your name" value={form.name} onChangeText={set('name')} autoCapitalize="words" />}
          {mode === 'login' && <Field icon="person-outline" placeholder="Username" value={form.username} onChangeText={set('username')} autoFocus />}
          <View style={styles.field}>
            <Ionicons name="lock-closed" size={18} color={colors.muted} />
            <TextInput
              style={styles.input}
              placeholder={signup ? 'Password (min 8 characters)' : 'Password'}
              placeholderTextColor={colors.muted}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={mode === 'unlock'}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={12}>
              <Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={colors.muted} />
            </Pressable>
          </View>
          {signup && <Field icon="key-outline" placeholder="Invite code" value={form.code} onChangeText={set('code')} />}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {busy ? <ActivityIndicator color={colors.accent} style={{ padding: 15 }} /> : <Button label={signup ? 'Create account' : 'Continue'} onPress={submit} disabled={!filled} />}
          {mode === 'unlock' && biometricReady && (
            <>
                            <Pressable onPress={() => { setError(''); setUsePassword(false); fingerprint(); }} style={({ pressed }) => [styles.switchRow, pressed && { opacity: 0.6 }]} hitSlop={12}>
                <Text style={styles.link}>Use fingerprint instead</Text>
              </Pressable>
            </>
          )}
          {mode === 'login' && (
            <Pressable onPress={() => { setError(''); setSignup((v) => !v); }} style={({ pressed }) => [styles.switchRow, pressed && { opacity: 0.6 }]} hitSlop={12}>
              <Text style={styles.link}>{signup ? 'I already have an account' : 'Create an account'}</Text>
            </Pressable>
          )}
        </View>
      )}
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ icon, ...props }: { icon: React.ComponentProps<typeof Ionicons>['name'] } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <TextInput style={styles.input} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} {...props} />
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
