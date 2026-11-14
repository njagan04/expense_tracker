import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { api, type Entry, type EntryType, type Summary } from '../../lib/api';
import { accountColor, colors, greeting, heroGradient, monthKey, monthLabel, OWNER_NAME, TYPE_STYLE, type IconName } from '../../lib/util';
import { Avatar } from '../../components/PersonPicker';
import { CranePond, type PondHandle } from '../../components/CranePond';
import { getPref } from '../../lib/prefs';
import { CountUp, Empty, EntryRow, Group, HiddenAmount, IconButton, Money, Row, Screen, s, Tap, TextAction, useFocusData } from '../../components/ui';

const QUICK: { type: EntryType; label: string; icon: IconName }[] = [
  { type: 'expense', label: 'Spend', icon: 'arrow-up' },
  { type: 'income', label: 'Receive', icon: 'arrow-down' },
  { type: 'transfer', label: 'Transfer', icon: 'swap-horizontal' },
  { type: 'lend', label: 'Lend', icon: 'person-add' },
  { type: 'repay', label: 'Got back', icon: 'checkmark-done' },
];


export default function Home() {
  const { data, refreshing, reload } = useFocusData(async () => {
    const [summary, { entries }] = await Promise.all([
      api<Summary>('/summary'),
      api<{ entries: Entry[] }>(`/entries?month=${monthKey(new Date())}`),
    ]);
    return { summary, entries };
  });

  // Balances start hidden, like a bank app, and hide again whenever the app goes to the background.
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'background') setHidden(true); });
    return () => sub.remove();
  }, []);
  const toggleHidden = () => setHidden((h) => !h);

  const pond = useRef<PondHandle>(null);
  // The cranes only animate while Home is the screen being shown.
  const [focused, setFocused] = useState(false);
  // Re-read the Settings switch each time Home is shown.
  const [cranesOn, setCranesOn] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); getPref('cranes').then(setCranesOn); return () => setFocused(false); }, []));

  const accounts = data?.summary.accounts ?? [];
  const entries = data?.entries ?? [];
  const total = accounts.reduce((t, a) => t + a.balance, 0);
  const sum = (type: Entry['type']) => entries.filter((e) => e.type === type).reduce((t, e) => t + e.amount, 0);
  const owing = (data?.summary.people ?? []).filter((p) => p.owes > 0).sort((a, b) => b.owes - a.owes);
  const owed = owing.reduce((t, p) => t + p.owes, 0);
  const recent = entries.slice(0, 6);
  const month = monthLabel(new Date()).split(' ')[0];

  return (
    <Screen
      title={OWNER_NAME}
      eyebrow={greeting()}
      refreshing={refreshing}
      onRefresh={reload}
      backdrop={cranesOn ? <CranePond ref={pond} paused={!focused} /> : undefined}
      onTouch={(x, y) => pond.current?.scatter(x, y)}
      left={
        <LinearGradient colors={heroGradient} style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800' }}>{OWNER_NAME[0]}</Text>
        </LinearGradient>
      }
      right={<IconButton icon="settings-outline" onPress={() => router.push('/settings')} />}
    >
      {/* Balance card, styled like a physical bank card. */}
      <View style={{ borderRadius: 28, overflow: 'hidden' }}>
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22 }}>
          {/* Faint rings in the corner, like the print on a card. */}
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
            {[70, 120, 170, 220].map((r) => <Circle key={r} cx="92%" cy="6%" r={r} stroke="#fff" strokeOpacity={0.09} strokeWidth={1.5} fill="none" />)}
          </Svg>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700', letterSpacing: 1.4 }}>TOTAL BALANCE</Text>
            <Pressable onPress={toggleHidden} hitSlop={12} style={({ pressed }) => [{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 17, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
              <Ionicons name={hidden ? 'eye-off' : 'eye'} size={18} color="#fff" />
            </Pressable>
          </View>

          <View style={{ height: 54, justifyContent: 'center', marginTop: 6 }}>
            {hidden ? <HiddenAmount amount={total} size={36} color="#fff" /> : <CountUp value={total} size={42} color="#fff" />}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 18, paddingVertical: 12 }}>
            <Flow icon="arrow-up" label={`Spent in ${month}`} value={sum('expense')} />
            <View style={{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.16)' }} />
            <Flow icon="arrow-down" label="Received" value={sum('income')} />
          </View>
        </LinearGradient>
      </View>

      {/* Quick actions in one bar. */}
      <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 14 }]}>
        {QUICK.map((q) => (
          <Tap key={q.type} onPress={() => router.push({ pathname: '/entry', params: { type: q.type } })} outerStyle={{ flex: 1 }} style={{ alignItems: 'center', gap: 7 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: TYPE_STYLE[q.type].color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={q.icon} size={21} color={TYPE_STYLE[q.type].color} />
            </View>
            <Text style={{ color: colors.text, fontSize: 11.5, fontWeight: '600' }} numberOfLines={1}>{q.label}</Text>
          </Tap>
        ))}
      </View>

      {/* Accounts as a grid of tiles; tap one to see its history. */}
      <View style={{ gap: 10 }}>
        <Text style={[s.groupTitle, { paddingHorizontal: 4 }]}>Accounts</Text>
        {data && !accounts.length ? (
          <View style={s.group}>
            <Row icon="wallet" label="No accounts yet" sub="Add them in Settings → Accounts" onPress={() => router.push('/settings')} last />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {accounts.map((a) => {
              const c = accountColor(a.id);
              return (
                <Tap key={a.id} onPress={() => router.navigate({ pathname: '/history', params: { account: String(a.id) } })} outerStyle={{ flexBasis: '47%', flexGrow: 1 }} style={[s.card, { padding: 16, gap: 14 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c + '26', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: c, fontWeight: '800', fontSize: 15 }}>{a.name[0]?.toUpperCase()}</Text>
                    </View>
                    <Text style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{a.name}</Text>
                  </View>
                  <View style={{ height: 26, justifyContent: 'center' }}>
                    {hidden ? <HiddenAmount amount={a.balance} size={17} /> : <CountUp value={a.balance} size={20} />}
                  </View>
                  {/* Accent line in the account's colour. */}
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: c, opacity: 0.55, width: 28 }} />
                </Tap>
              );
            })}
          </View>
        )}
      </View>

      {/* People who owe you, with their avatars overlapping. */}
      {owed > 0 && (
        <Tap onPress={() => router.navigate('/people')} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 }]}>
          <View style={{ flexDirection: 'row' }}>
            {owing.slice(0, 3).map((p, i) => (
              <View key={p.id} style={{ marginLeft: i ? -12 : 0, borderRadius: 22, borderWidth: 2, borderColor: colors.card, backgroundColor: colors.card }}>
                <Avatar name={p.name} id={p.id} size={38} />
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: '600', opacity: 0.85 }}>{owing.length} {owing.length === 1 ? 'person owes' : 'people owe'} you</Text>
            <Money value={owed} size={20} />
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Tap>
      )}

      {data && !recent.length ? (
        <Empty icon="receipt-outline" title="No entries this month" text="Tap + to add your first one." />
      ) : (
        <Group title="Recent activity" action={<TextAction label="See all" onPress={() => router.navigate('/history')} />}>
          {recent.map((e, i) => <EntryRow key={e.id} e={e} last={i === recent.length - 1} />)}
        </Group>
      )}
    </Screen>
  );
}

function Flow({ icon, label, value }: { icon: 'arrow-up' | 'arrow-down'; label: string; value: number }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={15} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
        <Money value={value} size={16} color="#fff" />
      </View>
    </View>
  );
}
