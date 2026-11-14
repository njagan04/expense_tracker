import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { api, type Entry, type EntryType, type Summary } from '../lib/api';
import { colors, inr, TYPE_STYLE, type IconName } from '../lib/util';
import { Avatar } from '../components/PersonPicker';
import { EntryRow, Group, ModalScreen, s, useFocusData } from '../components/ui';

// One person: what they owe / what you sent, every entry with them (tap to edit), and quick actions.
export default function PersonScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { data } = useFocusData(async () => {
    const [summary, { entries }] = await Promise.all([
      api<Summary>('/summary'),
      api<{ entries: Entry[] }>(`/entries?person_id=${id}`),
    ]);
    return { person: summary.people.find((p) => String(p.id) === id), entries };
  }, [id]);

  const p = data?.person;
  const start = (type: EntryType, amount?: number) =>
    router.push({ pathname: '/entry', params: { type, person: name, ...(amount ? { amount: String(amount) } : {}) } });

  return (
    <ModalScreen title={name}>
      <View style={[s.card, { alignItems: 'center', paddingVertical: 24, gap: 10 }]}>
        <Avatar name={name} id={Number(id)} size={64} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{name}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignSelf: 'stretch' }}>
          <Figure label="Owes you" value={p ? inr(Math.max(p.owes, 0)) : '—'} />
          <Figure label="Sent to them" value={p ? inr(p.sent) : '—'} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {!!p && p.owes > 0 && <Action icon="checkmark-done" label="Got back" color={TYPE_STYLE.repay.color} onPress={() => start('repay', p.owes)} />}
        <Action icon="person-add" label="Lend" color={TYPE_STYLE.lend.color} onPress={() => start('lend')} />
        <Action icon="paper-plane" label="Send" color={TYPE_STYLE.expense.color} onPress={() => start('expense')} />
      </View>

      <Group title="Entries" footer="Tap an entry to edit or delete it.">
        {data && !data.entries.length && <Text style={{ color: colors.muted, padding: 18, textAlign: 'center' }}>No entries with {name} yet.</Text>}
        {data?.entries.map((e, i) => <EntryRow key={e.id} e={e} last={i === data.entries.length - 1} showDate />)}
      </Group>
    </ModalScreen>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.elevated, borderRadius: 16, padding: 12, alignItems: 'center' }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function Action({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingVertical: 14, alignItems: 'center', gap: 6 }, pressed && { backgroundColor: colors.pressed }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
