import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { api, type Entry, type Summary } from '../../lib/api';
import { colors, dayLabel, inr, monthKey, monthLabel } from '../../lib/util';
import { Chips, Empty, EntryRow, Money, Screen, s, useFocusData } from '../../components/ui';

const addOn = (date: string) => router.push({ pathname: '/entry', params: { date } });

export default function History() {
  const params = useLocalSearchParams<{ account?: string }>();
  const [month, setMonth] = useState(() => new Date());
  const [accountId, setAccountId] = useState<number>(0); // 0 = all

  // Tapping an account on Home opens History filtered to it.
  useEffect(() => {
    if (params.account) setAccountId(Number(params.account));
  }, [params.account]);

  const { data, refreshing, reload } = useFocusData(async () => {
    const q = `month=${monthKey(month)}${accountId ? `&account_id=${accountId}` : ''}`;
    const [summary, { entries }] = await Promise.all([api<Summary>('/summary'), api<{ entries: Entry[] }>(`/entries?${q}`)]);
    return { accounts: summary.accounts, entries };
  }, [month, accountId]);

  const shift = (n: number) => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));
  const isCurrent = monthKey(month) === monthKey(new Date());
  const entries = data?.entries ?? [];
  const total = (t: Entry['type']) => entries.filter((e) => e.type === t).reduce((sum, e) => sum + e.amount, 0);

  const byDay = new Map<string, Entry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]); // newest first, from the API


  return (
    <Screen title="History" refreshing={refreshing} onRefresh={reload}>
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36 }}>
          <Pressable onPress={() => shift(-1)} hitSlop={14}>
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{monthLabel(month)}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={14} disabled={isCurrent}>
            <Ionicons name="chevron-forward" size={24} color={isCurrent ? colors.faint : colors.accent} />
          </Pressable>
        </View>

        <Chips
          options={[{ value: 0, label: 'All accounts' }, ...(data?.accounts ?? []).map((a) => ({ value: a.id, label: a.name }))]}
          value={accountId}
          onChange={setAccountId}
        />

        <View style={[s.group, { flexDirection: 'row' }]}>
          <Total label="Spent" value={inr(total('expense'))} color={colors.red} />
          <View style={{ width: 1, backgroundColor: colors.separator, marginVertical: 12 }} />
          <Total label="Received" value={inr(total('income'))} color={colors.green} />
        </View>
      </View>

      {data && !entries.length && <Empty icon="calendar-outline" title="Nothing here" text={`No entries in ${monthLabel(month)}.`} />}

      {[...byDay].map(([date, list]) => {
        const spent = list.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
        return (
        <View key={date} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            {/* Tap the date to add another entry on that day. */}
            <Pressable onPress={() => addOn(date)} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.5 }}>
              <Text style={s.groupTitle}>{dayLabel(date)}</Text>
            </Pressable>
            {spent > 0 && <Money value={spent} size={13.5} color={colors.muted} />}
          </View>
          <View style={s.group}>
            {list.map((e, i) => <EntryRow key={e.id} e={e} last={i === list.length - 1} />)}
          </View>
        </View>
        );
      })}
    </Screen>
  );
}


function Total({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color, marginTop: 4, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}
