import { useEffect, useRef, useState } from 'react';
import { Alert, Text, TextInput, View, type ScrollViewInstance, type TextInputInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { api, type Entry, type EntryType, type Summary } from '../lib/api';
import { accountColor, colors, dayLabel, showError, TYPE_LABEL, TYPE_STYLE, ymd } from '../lib/util';
import { CardAction, Chips, Group, ModalScreen, Row, s, Segmented, Tile } from '../components/ui';
import { CategoryPicker } from '../components/CategoryPicker';
import { PersonField } from '../components/PersonPicker';
import { DateField } from '../components/DatePicker';

const TYPES: EntryType[] = ['expense', 'income', 'transfer', 'lend', 'repay'];
const lastAccountKey = (t: EntryType) => `last_account_${t}`;
const PERSON_TITLE: Record<EntryType, string> = {
  expense: 'Person', income: 'Person', transfer: '', lend: 'Lent to', repay: 'Paid back by',
};

// Add a new entry, or edit one when opened with ?entry=<json>.
// Prefill for a new one: ?type=repay&person=Siva&amount=3000 (People → tap a person), ?date=2026-11-02 (History → tap a day).
export default function EntryScreen() {
  const params = useLocalSearchParams<{ entry?: string; type?: EntryType; person?: string; amount?: string; date?: string }>();
  const existing: Entry | null = params.entry ? JSON.parse(params.entry) : null;
  const initialType: EntryType = existing?.type ?? (TYPES.includes(params.type!) ? params.type! : 'expense');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [type, setType] = useState<EntryType>(initialType);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : params.amount ?? '');
  const [accountId, setAccountId] = useState<number | null>(existing?.account_id ?? null);
  const [toAccountId, setToAccountId] = useState<number | null>(existing?.to_account_id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(existing?.category_id ?? null);
  const [person, setPerson] = useState(existing?.person ?? params.person ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [date, setDate] = useState(existing?.date ?? params.date ?? ymd(new Date()));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Summary>('/summary').then(setSummary, showError);
  }, []);

  // New entries start on the account you last used for this type (e.g. lend/repay -> your lending account).
  useEffect(() => {
    if (existing || !summary) return;
    SecureStore.getItemAsync(lastAccountKey(type)).then((v) => {
      const ids = summary.accounts.map((a) => a.id);
      if (ids.includes(Number(v))) setAccountId(Number(v));
      else setAccountId((id) => id ?? ids[0] ?? null);
    }, () => {});
  }, [type, summary]);

  const accounts = (summary?.accounts ?? []).map((a) => ({ value: a.id, label: a.name, color: accountColor(a.id) }));
  const needsPerson = type === 'lend' || type === 'repay';
  // Repayments can only come from people who owe you; everything else can use anyone.
  const suggestions = (summary?.people ?? []).filter((p) => type !== 'repay' || p.owes > 0);
  const hasCategory = type === 'expense'; // income (salary etc.) has no category
  const amountColor = type === 'income' || type === 'repay' ? colors.green : colors.text;

  const scrollRef = useRef<ScrollViewInstance>(null);
  // Open the keyboard only after the screen has finished sliding in; doing both at once makes the animation stutter.
  const amountRef = useRef<TextInputInstance>(null);
  useEffect(() => {
    if (existing) return;
    const id = setTimeout(() => amountRef.current?.focus(), 450);
    return () => clearTimeout(id);
  }, []);

  const save = async () => {
    const n = Number(amount);
    if (!(n > 0)) return Alert.alert('Enter an amount');
    if (!accountId) return Alert.alert('No account yet', 'Add an account in Settings first.');
    if (type === 'transfer' && !toAccountId) return Alert.alert('Choose where the money went');
    if (needsPerson && !person.trim()) return Alert.alert('Enter the person’s name');
    setBusy(true);
    try {
      const body = {
        date, type, amount: n, account_id: accountId,
        to_account_id: type === 'transfer' ? toAccountId : null,
        category_id: hasCategory ? categoryId : null,
        person: type === 'transfer' ? null : person.trim() || null,
        note,
      };
      if (existing) await api(`/entries/${existing.id}`, 'PUT', body);
      else await api('/entries', 'POST', body);
      SecureStore.setItemAsync(lastAccountKey(type), String(accountId)).catch(() => {});
      router.back();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => api(`/entries/${existing!.id}`, 'DELETE').then(() => router.back(), showError) },
    ]);

  return (
    <ModalScreen title={existing ? 'Edit Entry' : 'New Entry'} onDone={save} doneLabel={existing ? 'Save' : 'Add'} doneDisabled={busy} scrollRef={scrollRef}>
      <Segmented options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} value={type} onChange={setType} />

      {/* Amount */}
      <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 30, fontWeight: '600', color: colors.muted, marginRight: 4 }}>₹</Text>
          <TextInput
            style={{ fontSize: 48, fontWeight: '700', color: amountColor, minWidth: 60, padding: 0, fontVariant: ['tabular-nums'] }}
            placeholder="0"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            ref={amountRef}
            value={amount}
            onChangeText={setAmount}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Tile icon={TYPE_STYLE[type].icon} color={TYPE_STYLE[type].color} size={18} />
          <Text style={{ color: colors.muted, fontSize: 13 }}>{TYPE_LABEL[type]}</Text>
        </View>
      </View>

      <Group title={type === 'transfer' ? 'From' : 'Account'}>
        <View style={{ padding: 12 }}>
          <Chips onCard options={accounts} value={accountId} onChange={setAccountId} />
        </View>
      </Group>

      {type === 'transfer' && (
        <Group title="To">
          <View style={{ padding: 12 }}>
            <Chips onCard options={accounts.filter((a) => a.value !== accountId)} value={toAccountId} onChange={setToAccountId} />
          </View>
        </Group>
      )}

      {hasCategory && summary && (
        <CategoryPicker
          categories={summary.categories}
          value={categoryId}
          onChange={setCategoryId}
          onCreated={(c) => setSummary({ ...summary, categories: [...summary.categories, c] })}
        />
      )}

      {/* Lend / Got back: the person is the point of the entry, so it gets its own section. */}
      {needsPerson && (
        <Group title={PERSON_TITLE[type]}>
          <PersonField value={person} onChange={setPerson} people={suggestions} required showOwes={type === 'repay'} label={PERSON_TITLE[type]} last />
        </Group>
      )}

      <Group>
        <DateField value={date} onChange={setDate} />
        {/* Expense / Income: optionally tag who it was for (adds up under People → Sent to). */}
        {(type === 'expense' || type === 'income') && <PersonField value={person} onChange={setPerson} people={suggestions} />}
        <View style={s.row}>
          <Tile icon="create" color={colors.orange} />
          <TextInput
            style={[s.rowBody, { fontSize: 16, color: colors.text }]}
            placeholder="Note"
            // Wait for the keyboard to finish opening, then bring the note into view.
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
            placeholderTextColor={colors.muted}
            value={note}
            onChangeText={setNote}
            maxLength={500}
          />
        </View>
      </Group>

      {existing && (
        <CardAction label="Delete Entry" onPress={remove} danger />
      )}
    </ModalScreen>
  );
}

