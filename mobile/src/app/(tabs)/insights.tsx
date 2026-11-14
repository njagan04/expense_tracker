import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, type Entry } from '../../lib/api';
import { colors, inr, monthKey, monthLabel } from '../../lib/util';
import { Donut, type Slice } from '../../components/Donut';
import { EntryRow, Group, Screen, s, Segmented, useFocusData } from '../../components/ui';

type Mode = 'month' | 'year';

// Slice colours in fixed order (checked for colour-blind separation on the dark card); the rest fold into grey.
const SLICE_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const REST_COLOR = '#5E5E6E';

// Income vs spending only: transfers move money between your own accounts, lending is tracked in People.
function summarize(entries: Entry[]) {
  const income = entries.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const expenses = entries.filter((e) => e.type === 'expense');
  const spent = expenses.reduce((a, e) => a + e.amount, 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    const k = e.category ?? (e.person ? 'Sent to people' : 'Uncategorized');
    byCat.set(k, (byCat.get(k) ?? 0) + e.amount);
  }
  const ranked = [...byCat].sort((a, b) => b[1] - a[1]);
  const slices: Slice[] = ranked.slice(0, SLICE_COLORS.length).map(([label, value], i) => ({ label, value, color: SLICE_COLORS[i] }));
  const rest = ranked.slice(SLICE_COLORS.length).reduce((a, [, v]) => a + v, 0);
  if (rest > 0) slices.push({ label: `Rest (${ranked.length - SLICE_COLORS.length})`, value: rest, color: REST_COLOR });
  const biggest = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 3);
  return { income, spent, saved: income - spent, slices, biggest };
}

export default function Insights() {
  const [mode, setMode] = useState<Mode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [picked, setPicked] = useState<number | null>(null);
  // ponytail: loads every entry and totals on the phone; fine for a personal tracker, move to SQL if it reaches many thousands.
  const { data, refreshing, reload } = useFocusData(() => api<{ entries: Entry[] }>('/entries').then((r) => r.entries));
  const all = data ?? [];

  const now = new Date();
  const y = cursor.getFullYear();
  const key = mode === 'month' ? monthKey(cursor) : String(y);
  const prevKey = mode === 'month' ? monthKey(new Date(y, cursor.getMonth() - 1, 1)) : String(y - 1);
  const prevName = mode === 'month' ? monthLabel(new Date(y, cursor.getMonth() - 1, 1)).split(' ')[0] : String(y - 1);
  const atCurrent = mode === 'month' ? key === monthKey(now) : y === now.getFullYear();
  const of = (k: string) => summarize(all.filter((e) => e.date.startsWith(k)));
  const cur = of(key);
  const prev = of(prevKey);

  const go = (n: number) => {
    setPicked(null);
    setCursor((d) => (mode === 'month' ? new Date(d.getFullYear(), d.getMonth() + n, 1) : new Date(d.getFullYear() + n, 0, 1)));
  };
  const label = mode === 'month' ? monthLabel(cursor) : String(y);

  const days = mode === 'month'
    ? (atCurrent ? now.getDate() : new Date(y, cursor.getMonth() + 1, 0).getDate())
    : (atCurrent ? Math.ceil((now.getTime() - new Date(y, 0, 1).getTime()) / 86_400_000) : 365);
  const savedPct = cur.income > 0 ? Math.round((cur.saved / cur.income) * 100) : null;
  const spentChange = prev.spent > 0 ? Math.round(((cur.spent - prev.spent) / prev.spent) * 100) : null;

  const sel = picked != null ? cur.slices[picked] : null;

  // Year view: one row per month, newest first (up to this month for the current year).
  const yearRows = mode === 'year'
    ? Array.from({ length: (atCurrent ? now.getMonth() : 11) + 1 }, (_, m) => {
        const k = `${y}-${String(m + 1).padStart(2, '0')}`;
        return { k, ...of(k) };
      }).reverse()
    : [];

  return (
    <Screen title="Insights" refreshing={refreshing} onRefresh={reload}>
      <View style={{ gap: 16 }}>
        <Segmented<Mode> options={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }]} value={mode} onChange={(m) => { setMode(m); setCursor(new Date()); setPicked(null); }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36 }}>
          <Pressable onPress={() => go(-1)} hitSlop={14}><Ionicons name="chevron-back" size={22} color={colors.accent} /></Pressable>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{label}</Text>
          <Pressable onPress={() => go(1)} hitSlop={14} disabled={atCurrent}><Ionicons name="chevron-forward" size={22} color={atCurrent ? colors.faint : colors.accent} /></Pressable>
        </View>
      </View>

      {/* Summary: income, spent, saved in one card. */}
      <View style={s.card}>
        <View style={{ flexDirection: 'row' }}>
          <Figure label="Income" value={inr(cur.income)} color={colors.green} />
          <Figure label="Spent" value={inr(cur.spent)} />
          <Figure label={cur.saved >= 0 ? 'Saved' : 'Overspent'} value={inr(Math.abs(cur.saved))} color={cur.saved >= 0 ? colors.accent : colors.red} />
        </View>
        <View style={{ height: 1, backgroundColor: colors.separator, marginVertical: 14 }} />
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
          {savedPct !== null && <Text style={{ color: colors.text, fontWeight: '700' }}>{savedPct >= 0 ? `${savedPct}% saved` : `${-savedPct}% over income`}</Text>}
          {savedPct !== null && '  ·  '}
          Avg <Text style={{ color: colors.text, fontWeight: '700' }}>{inr(Math.round(cur.spent / Math.max(days, 1)))}</Text>/day
          {spentChange !== null && '  ·  '}
          {spentChange !== null && (
            <Text style={{ color: spentChange > 0 ? colors.red : colors.green, fontWeight: '700' }}>
              {spentChange > 0 ? '▲' : '▼'} {Math.abs(spentChange)}% spend vs {prevName}
            </Text>
          )}
        </Text>
      </View>

      {/* Spending by category */}
      <Group title="Spending by category">
        {!cur.slices.length ? (
          <Text style={{ color: colors.muted, padding: 24, textAlign: 'center' }}>No spending in {label}.</Text>
        ) : (
          <View style={{ paddingVertical: 20, gap: 18 }}>
            <Donut
              slices={cur.slices}
              selected={picked}
              center={sel ? { top: sel.label, bottom: inr(sel.value) } : { top: 'Total spent', bottom: inr(cur.spent) }}
            />
            <View>
              {cur.slices.map((sl, i) => {
                const on = picked === i;
                return (
                  <Pressable key={sl.label} onPress={() => setPicked(on ? null : i)} style={({ pressed }) => [s.row, { minHeight: 48 }, (on || pressed) && { backgroundColor: colors.pressed }]}>
                    <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: sl.color }} />
                    <View style={[s.rowBody, i < cur.slices.length - 1 && s.rowSeparator]}>
                      <Text style={[s.rowLabel, { flex: 1, fontWeight: on ? '700' : '500' }]} numberOfLines={1}>{sl.label}</Text>
                      <Text style={[s.amount, { fontSize: 15 }]}>{inr(sl.value)}</Text>
                      <Text style={{ color: colors.muted, fontSize: 13, width: 44, textAlign: 'right' }}>{Math.round((sl.value / cur.spent) * 100)}%</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </Group>

      {mode === 'year' && (
        <Group title="Month by month" footer="Tap a month to open it.">
          <View style={[s.row, { minHeight: 36 }]}>
            <View style={[s.rowBody, s.rowSeparator, { paddingVertical: 9 }]}>
              {['Month', 'Income', 'Spent', 'Saved'].map((h, i) => (
                <Text key={h} style={{ flex: i === 0 ? 0.7 : 1, textAlign: i === 0 ? 'left' : 'right', color: colors.muted, fontSize: 12, fontWeight: '700' }}>{h}</Text>
              ))}
            </View>
          </View>
          {yearRows.map((r, i) => (
            <Pressable key={r.k} onPress={() => { setMode('month'); setCursor(new Date(r.k + '-01T00:00:00')); setPicked(null); }} style={({ pressed }) => [s.row, { minHeight: 46 }, pressed && { backgroundColor: colors.pressed }]}>
              <View style={[s.rowBody, i < yearRows.length - 1 && s.rowSeparator]}>
                <Text style={{ flex: 0.7, color: colors.text, fontWeight: '600' }}>{monthLabel(new Date(r.k + '-01T00:00:00')).slice(0, 3)}</Text>
                <Num v={r.income} />
                <Num v={r.spent} />
                <Num v={r.saved} color={r.saved < 0 ? colors.red : r.saved > 0 ? colors.green : colors.muted} />
              </View>
            </Pressable>
          ))}
        </Group>
      )}

      {mode === 'month' && cur.biggest.length > 0 && (
        <Group title="Biggest expenses">
          {cur.biggest.map((e, i) => <EntryRow key={e.id} e={e} last={i === cur.biggest.length - 1} showDate />)}
        </Group>
      )}
    </Screen>
  );
}

function Figure({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color, fontSize: 17, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function Num({ v, color = colors.text }: { v: number; color?: string }) {
  return <Text style={{ flex: 1, textAlign: 'right', color, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{v ? inr(Math.round(v)).replace('₹', '') : '—'}</Text>;
}
