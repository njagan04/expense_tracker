import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, type Account } from '../lib/api';
import { accountColor, colors, inr, showError } from '../lib/util';
import { CardAction, Group, ModalScreen, Row, s, Tile } from '../components/ui';

// Add an account, or edit one when opened with ?account=<json>.
export default function AccountScreen() {
  const params = useLocalSearchParams<{ account?: string }>();
  const existing: Account | null = params.account ? JSON.parse(params.account) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [opening, setOpening] = useState(existing ? String(existing.opening_balance) : '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = opening.trim() ? Number(opening) : 0;
    if (!name.trim()) return Alert.alert('Give the account a name');
    if (!Number.isFinite(n)) return Alert.alert('Enter a valid opening balance');
    setBusy(true);
    try {
      if (existing) await api('/accounts', 'PATCH', { id: existing.id, name, opening_balance: n });
      else await api('/accounts', 'POST', { name, opening_balance: n });
      router.back();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert(`Delete "${existing!.name}"?`, 'Only possible when the account has no entries.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => api(`/accounts?id=${existing!.id}`, 'DELETE').then(() => router.back(), showError) },
    ]);

  return (
    <ModalScreen title={existing ? 'Edit Account' : 'New Account'} onDone={save} doneDisabled={busy || !name.trim()}>
      <View style={{ alignItems: 'center', gap: 10, marginTop: 8 }}>
        <Tile icon="wallet" color={existing ? accountColor(existing.id) : colors.accent} size={72} />
        <Text style={{ fontSize: 22, fontWeight: '700', color: name ? colors.text : colors.faint }}>{name || 'Account name'}</Text>
      </View>

      <Group title="Name">
        <TextInput style={s.input} placeholder="e.g. HDFC Savings" placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={30} autoFocus={!existing} />
      </Group>

      <Group title="Opening balance" footer="Your bank balance on the day you started tracking. Every entry is added on top of this.">
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
          <Text style={{ fontSize: 16, color: colors.muted }}>₹</Text>
          <TextInput style={[s.input, { flex: 1, paddingLeft: 6 }]} placeholder="0" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" value={opening} onChangeText={setOpening} />
        </View>
      </Group>

      {existing && (
        <>
          <Group>
            <Row label="Current balance" value={inr(existing.balance)} valueColor={colors.text} last />
          </Group>
          <CardAction label="Delete Account" onPress={remove} danger />
        </>
      )}
    </ModalScreen>
  );
}
