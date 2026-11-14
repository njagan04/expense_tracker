import { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, logout, userName, type Summary } from '../lib/api';
import { accountColor, colors, heroGradient, inr } from '../lib/util';
import { CardAction, Group, ModalScreen, Row, s, useFocusData } from '../components/ui';
import { getPref, setPref, type Pref } from '../lib/prefs';

// A saved on/off setting shown as a switch.
function usePref(p: Pref) {
  const [on, setOn] = useState(true);
  useEffect(() => { getPref(p).then(setOn); }, [p]);
  return [on, (v: boolean) => { setOn(v); setPref(p, v); }] as const;
}

const toggle = (on: boolean, set: (v: boolean) => void) => (
  <Switch value={on} onValueChange={set} trackColor={{ false: colors.elevated, true: colors.accent }} thumbColor="#fff" />
);

export default function Settings() {
  const { data } = useFocusData(() => api<Summary>('/summary'));
  const accounts = data?.accounts ?? [];
  const [cranes, setCranes] = usePref('cranes');
  const [lock, setLock] = usePref('lock');
  const [fingerprint, setFingerprint] = usePref('fingerprint');

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You will need your password to log in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);

  return (
    <ModalScreen title="Settings">
      <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
        <LinearGradient colors={heroGradient} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="wallet" size={28} color={colors.onAccent} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>{userName()}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>Expense Tracker · Encrypted</Text>
          </View>
        </View>
      </View>

      <Group title="Accounts" footer="Tap an account to rename it or change its opening balance.">
        {accounts.map((a) => (
          <Row
            key={a.id}
            icon="wallet"
            color={accountColor(a.id)}
            label={a.name}
            sub={`Opening ${inr(a.opening_balance)}`}
            value={inr(a.balance)}
            valueColor={colors.text}
            onPress={() => router.push({ pathname: '/account', params: { account: JSON.stringify(a) } })}
          />
        ))}
        <Row icon="add" color={colors.accent} label="Add account" onPress={() => router.push('/account')} last />
      </Group>

      <Group title="General">
        <Row icon="pricetags" color={colors.purple} label="Categories" value={data ? String(data.categories.length) : undefined} onPress={() => router.push('/categories')} last />
      </Group>

      <Group title="Appearance">
        <Row icon="sparkles" color={colors.violet} label="Crane animation" sub="Birds flying behind the Home screen" valueNode={toggle(cranes, setCranes)} last />
      </Group>

      <Group
        title="Security"
        footer={!lock ? 'Anyone holding your unlocked phone can open the app.' : fingerprint ? undefined : 'You unlock the app with your password.'}
      >
        <Row icon="lock-open" color={colors.accent} label="App lock" sub={lock ? 'Ask to unlock every time the app opens' : 'Opens straight to Home'} valueNode={toggle(lock, setLock)} />
        {lock && <Row icon="finger-print" color={colors.green} label="Fingerprint unlock" sub={fingerprint ? 'Unlock with fingerprint or phone PIN' : 'Password only'} valueNode={toggle(fingerprint, setFingerprint)} />}
        <Row icon="lock-closed" color={colors.blue} label="Encryption" value="AES-256" last />
      </Group>

      <CardAction label="Log out" onPress={confirmLogout} danger />

      <Text style={{ textAlign: 'center', color: colors.faint, fontSize: 12 }}>Version {Constants.expoConfig?.version}</Text>
    </ModalScreen>
  );
}
