import { useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { api, type Entry, type Person, type Summary } from '../../lib/api';
import { colors, inr, monthKey, monthLabel, peopleGradient, showError } from '../../lib/util';
import { Avatar } from '../../components/PersonPicker';
import { Chips, Empty, Screen, s, Segmented, useFocusData } from '../../components/ui';

type Tab = 'owes' | 'sent' | 'all';
type Period = 'all' | 'month';
// Per-person totals; all-time from the summary, or just one month's entries.
type Totals = { person: Person; lent: number; repaid: number; owes: number; sent: number };

const openPerson = (p: Person) => router.push({ pathname: '/person', params: { id: String(p.id), name: p.name } });

export default function People() {
  const [tab, setTab] = useState<Tab>('owes');
  const [period, setPeriod] = useState<Period>('all');
  const [month, setMonth] = useState(() => new Date());
  const [newName, setNewName] = useState('');

  const { data, refreshing, reload } = useFocusData(async () => {
    const [summary, monthEntries] = await Promise.all([
      api<Summary>('/summary'),
      period === 'month' ? api<{ entries: Entry[] }>(`/entries?month=${monthKey(month)}`).then((r) => r.entries) : Promise.resolve(null),
    ]);
    return { people: summary.people, monthEntries };
  }, [period, month]);

  const people = data?.people ?? [];
  const totals: Totals[] = data?.monthEntries
    ? people.map((p) => {
        const mine = data.monthEntries!.filter((e) => e.person?.toLowerCase() === p.name.toLowerCase());
        const sum = (t: Entry['type']) => mine.filter((e) => e.type === t).reduce((a, e) => a + e.amount, 0);
        return { person: p, lent: sum('lend'), repaid: sum('repay'), owes: sum('lend') - sum('repay'), sent: sum('expense') };
      })
    : people.map((p) => ({ person: p, lent: p.lent, repaid: p.lent - p.owes, owes: p.owes, sent: p.sent }));

  const lending = period === 'all'
    ? totals.filter((t) => t.owes !== 0).sort((a, b) => b.owes - a.owes)
    : totals.filter((t) => t.lent || t.repaid).sort((a, b) => b.lent - a.lent);
  const settled = period === 'all' ? totals.filter((t) => t.lent > 0 && t.owes === 0) : [];
  const sentTo = totals.filter((t) => t.sent > 0).sort((a, b) => b.sent - a.sent);
  const when = period === 'all' ? 'all time' : `in ${monthLabel(month)}`;

  const hero = {
    owes: period === 'all'
      ? ['Owed to you', inr(lending.reduce((a, t) => a + Math.max(t.owes, 0), 0)), lending.length ? `${lending.length} ${lending.length === 1 ? 'person' : 'people'} yet to pay back` : 'Nobody owes you']
      : [`Lent ${when}`, inr(lending.reduce((a, t) => a + t.lent, 0)), `Got back ${inr(lending.reduce((a, t) => a + t.repaid, 0))}`],
    sent: ['Total sent', inr(sentTo.reduce((a, t) => a + t.sent, 0)), `To ${sentTo.length} ${sentTo.length === 1 ? 'person' : 'people'}, ${when}`],
    all: ['People', String(people.length), 'Add names here to tag them on entries'],
  }[tab];

  const addPerson = async () => {
    if (!newName.trim()) return;
    try {
      await api('/people', 'POST', { name: newName });
      setNewName('');
      reload();
    } catch (e) {
      showError(e);
    }
  };

  const removePerson = (p: Person) =>
    Alert.alert(`Remove ${p.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => api(`/people?id=${p.id}`, 'DELETE').then(reload, showError) },
    ]);

  const shift = (n: number) => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));
  const atCurrent = monthKey(month) === monthKey(new Date());

  return (
    <Screen title="People" refreshing={refreshing} onRefresh={reload}>
      <LinearGradient colors={peopleGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 22 }}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '700' }}>{hero[0]}</Text>
        <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1, marginTop: 6, fontVariant: ['tabular-nums'] }}>{hero[1]}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 4, fontSize: 13 }}>{hero[2]}</Text>
      </LinearGradient>

      <Segmented<Tab>
        options={[{ value: 'owes', label: 'Owes you' }, { value: 'sent', label: 'Sent to' }, { value: 'all', label: 'All' }]}
        value={tab}
        onChange={setTab}
      />

      {/* Period: all time, or one month at a time. */}
      {tab !== 'all' && (
        <View style={{ gap: 12 }}>
          <Chips options={[{ value: 'all', label: 'All time' }, { value: 'month', label: 'Monthly' }]} value={period} onChange={setPeriod} />
          {period === 'month' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36 }}>
              <Pressable onPress={() => shift(-1)} hitSlop={14}><Ionicons name="chevron-back" size={22} color={colors.accent} /></Pressable>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{monthLabel(month)}</Text>
              <Pressable onPress={() => shift(1)} hitSlop={14} disabled={atCurrent}><Ionicons name="chevron-forward" size={22} color={atCurrent ? colors.faint : colors.accent} /></Pressable>
            </View>
          )}
        </View>
      )}

      {tab === 'owes' && (
        <View style={{ gap: 10 }}>
          {data && !lending.length && (
            <Empty icon="person-add-outline" title={period === 'all' ? 'Nobody owes you' : 'No lending this month'} text={'Use "Lend" when you give someone money they\'ll return.'} />
          )}
          {lending.map((t) => (
            <PersonCard
              key={t.person.id} p={t.person}
              // Only when it adds something beyond the amount on the right (a partial payback).
              sub={t.repaid > 0 ? `Lent ${inr(t.lent)} · Got back ${inr(t.repaid)}` : undefined}
              value={t.owes >= 0 ? inr(t.owes) : `+${inr(-t.owes)}`}
              valueColor={t.owes > 0 ? colors.text : colors.green}
              // All time: tap to record a payback straight away. Monthly: open their page.
              onPress={period === 'all' && t.owes > 0
                ? () => router.push({ pathname: '/entry', params: { type: 'repay', person: t.person.name, amount: String(t.owes) } })
                : () => openPerson(t.person)}
            />
          ))}
          {period === 'all' && lending.length > 0 && <Text style={s.footer}>Tap a person when they pay you back.</Text>}

          {settled.length > 0 && <Text style={[s.groupTitle, { marginTop: 12, paddingHorizontal: 4 }]}>Settled</Text>}
          {settled.map((t) => (
            <PersonCard key={t.person.id} p={t.person} sub={`Lent ${inr(t.lent)}`} value="Paid back" valueColor={colors.green} onPress={() => openPerson(t.person)} />
          ))}
        </View>
      )}

      {tab === 'sent' && (
        <View style={{ gap: 10 }}>
          {data && !sentTo.length && <Empty icon="paper-plane-outline" title="Nothing sent" text={`No money sent to anyone ${when}. Tag a person on an expense (e.g. Mom) and it adds up here.`} />}
          {sentTo.map((t) => (
            <PersonCard key={t.person.id} p={t.person} value={inr(t.sent)} valueColor={colors.text} onPress={() => openPerson(t.person)} />
          ))}
        </View>
      )}

      {tab === 'all' && (
        <View style={{ gap: 10 }}>
          <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }]}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent + '26', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person-add" size={19} color={colors.accent} />
            </View>
            <TextInput
              style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 }}
              placeholder="Add a person"
              placeholderTextColor={colors.muted}
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={addPerson}
              returnKeyType="done"
              maxLength={100}
              autoCapitalize="words"
            />
            <Pressable onPress={addPerson} disabled={!newName.trim()} hitSlop={10}>
              <Ionicons name="add-circle" size={30} color={newName.trim() ? colors.accent : colors.faint} />
            </Pressable>
          </View>

          {people.map((p) => (
            <PersonCard
              key={p.id} p={p} sub={describe(p)} onPress={() => openPerson(p)}
              right={p.entries === 0 ? (
                <Pressable onPress={() => removePerson(p)} hitSlop={12}>
                  <Ionicons name="remove-circle" size={24} color={colors.red} />
                </Pressable>
              ) : undefined}
            />
          ))}
          {people.length > 0 && <Text style={s.footer}>People with no entries can be removed. Others stay so your history is kept.</Text>}
        </View>
      )}
    </Screen>
  );
}

function describe(p: Person) {
  const parts = [p.owes > 0 && `Owes ${inr(p.owes)}`, p.sent > 0 && `Sent ${inr(p.sent)}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : p.entries ? 'All settled' : 'No entries yet';
}

// One person per card.
function PersonCard({ p, value, valueColor, sub, onPress, right }: {
  p: Person; value?: string; valueColor?: string; sub?: string; onPress?: () => void; right?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.card, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }, pressed && { backgroundColor: colors.pressed }]}>
      <Avatar name={p.name} id={p.id} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { fontWeight: '700' }]} numberOfLines={1}>{p.name}</Text>
        {!!sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {!!value && <Text style={[s.amount, { color: valueColor }]}>{value}</Text>}
      {right}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
    </Pressable>
  );
}
