import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, dayLabel, monthLabel, ymd } from '../lib/util';
import { Row } from './ui';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// The "📅 Date" row on entry forms. Tapping it opens the calendar sheet.
export function DateField({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Row icon="calendar" color={colors.red} label="Date" value={dayLabel(value)} onPress={() => setOpen(true)} />
      <DateSheet visible={open} value={value} onClose={() => setOpen(false)} onPick={(d) => { onChange(d); setOpen(false); }} />
    </>
  );
}

// Month calendar in the app's own style. Future days are disabled (entries are things that already happened).
function DateSheet({ visible, value, onClose, onPick }: { visible: boolean; value: string; onClose: () => void; onPick: (d: string) => void }) {
  const insets = useSafeAreaInsets();
  const selected = new Date(value + 'T00:00:00');
  const [view, setView] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const today = ymd(new Date());
  const yesterday = ymd(new Date(Date.now() - 86_400_000));
  const atCurrentMonth = view.getFullYear() === new Date().getFullYear() && view.getMonth() === new Date().getMonth();

  // Leading blanks so day 1 lands on its weekday, then every day of the month.
  const first = view.getDay();
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: count }, (_, i) => ymd(new Date(view.getFullYear(), view.getMonth(), i + 1))),
  ];
  while (cells.length % 7) cells.push(null);

  const shift = (n: number) => setView((d) => new Date(d.getFullYear(), d.getMonth() + n, 1));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingBottom: insets.bottom + 18 }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.faint }} />
        </View>

        {/* Shortcuts */}
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
          {[['Today', today], ['Yesterday', yesterday]].map(([label, d]) => (
            <Pressable key={label} onPress={() => onPick(d)} style={({ pressed }) => [{ flex: 1, paddingVertical: 11, borderRadius: 14, alignItems: 'center', backgroundColor: value === d ? colors.accent : colors.elevated }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: value === d ? colors.onAccent : colors.text, fontWeight: '700' }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Month header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }}>
          <Pressable onPress={() => shift(-1)} hitSlop={14} style={{ padding: 6 }}>
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{monthLabel(view)}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={14} disabled={atCurrentMonth} style={{ padding: 6 }}>
            <Ionicons name="chevron-forward" size={22} color={atCurrentMonth ? colors.faint : colors.accent} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700', paddingVertical: 6 }}>{w}</Text>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (!d) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 46 }} />;
            const future = d > today;
            const isSel = d === value;
            const isToday = d === today;
            return (
              <Pressable key={d} disabled={future} onPress={() => onPick(d)} style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' }}>
                <View style={[
                  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
                  isSel && { backgroundColor: colors.accent },
                  !isSel && isToday && { borderWidth: 1.5, borderColor: colors.accent },
                ]}>
                  <Text style={{ fontSize: 15, fontWeight: isSel || isToday ? '800' : '500', color: isSel ? colors.onAccent : future ? colors.faint : colors.text }}>
                    {Number(d.slice(8))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
