import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Entry } from '../lib/api';
import { colors, dayLabel, direction, entryStyle, inr, showError, TYPE_LABEL, type IconName } from '../lib/util';

// Loads data every time the screen comes into focus (so it's fresh after adding an entry).
export function useFocusData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await load());
    } catch (e) {
      showError(e);
    } finally {
      setRefreshing(false);
    }
  }, deps);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  return { data, refreshing, reload };
}

// Tab screen: bold title + scrolling content.
export function Screen({ title, eyebrow, left, right, children, refreshing, onRefresh, backdrop, onTouch }: {
  title: string;
  eyebrow?: string;
  left?: ReactNode;
  right?: ReactNode;
  backdrop?: ReactNode; // decorative layer drawn behind the content (never takes touches)
  onTouch?: (pageX: number, pageY: number) => void; // told about every touch, without intercepting it
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onTouchStart={onTouch ? (e) => onTouch(e.nativeEvent.pageX, e.nativeEvent.pageY) : undefined}>
      {backdrop}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: insets.bottom + 130, gap: 22 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.onAccent]} progressBackgroundColor={colors.accent} /> : undefined}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, gap: 12 }}>
          {left}
          <View style={{ flex: 1 }}>
            {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
            <Text style={s.largeTitle}>{title}</Text>
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
      {/* Content fades out as it scrolls under the floating tab bar, so nothing peeks through the gap. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(7,7,11,0)', 'rgba(7,7,11,0.88)', colors.bg]}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 120 }}
      />
      {/* Same idea at the top, under the status bar. */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.bg, 'rgba(7,7,11,0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 8 }}
      />
    </View>
  );
}

// Full-screen sheet with "✕  Title  Save" bar.
export function ModalScreen({ title, onDone, doneLabel = 'Save', doneDisabled, children, scrollRef }: {
  title: string;
  onDone?: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  children: ReactNode;
  scrollRef?: RefObject<ScrollViewInstance | null>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.navBar, { paddingTop: insets.top + 10 }]}>
        <IconButton icon="close" onPress={() => router.back()} />
        <Text style={s.navTitle} numberOfLines={1}>{title}</Text>
        {onDone ? (
          <Pressable onPress={onDone} disabled={doneDisabled} style={({ pressed }) => [s.navDone, (pressed || doneDisabled) && { opacity: 0.5 }]}>
            <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 15 }}>{doneLabel}</Text>
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>
      {/* Shrinks above the keyboard so inputs near the bottom (like Note) stay visible. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 22 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function IconButton({ icon, onPress, size = 40 }: { icon: IconName; onPress: () => void; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, pressed && { backgroundColor: colors.pressed }]}>
      <Ionicons name={icon} size={size * 0.5} color={colors.text} />
    </Pressable>
  );
}

// Pressable that gently presses in. `outerStyle` carries layout (flex, width); `style` is the visible surface.
export function Tap({ onPress, style, outerStyle, children }: {
  onPress: () => void; style?: StyleProp<ViewStyle>; outerStyle?: StyleProp<ViewStyle>; children: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} style={outerStyle}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// Money in one consistent style: the ₹ is the same size as the digits (so it sits on the same line
// and height), just a little lighter; paise are shown smaller.
export function Money({ value, size = 16, color = colors.text, sign }: { value: number; size?: number; color?: string; sign?: string }) {
  const [int, dec] = inr(Math.abs(value)).slice(1).split('.');
  return (
    <Text style={{ fontSize: size, fontWeight: '800', color, fontVariant: ['tabular-nums'], letterSpacing: size > 24 ? -0.8 : 0 }} numberOfLines={1} adjustsFontSizeToFit>
      {sign ?? (value < 0 ? '−' : '')}
      <Text style={{ fontWeight: '600', opacity: 0.8 }}>₹{' '}</Text>
      {int}
      {!!dec && <Text style={{ fontSize: size * 0.7, opacity: 0.8 }}>.{dec}</Text>}
    </Text>
  );
}

// Money that counts up from zero when it appears or changes (used when a hidden balance is revealed).
export function CountUp({ value, ...rest }: { value: number; size?: number; color?: string }) {
  const [shown, setShown] = useState(0);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    const id = t.addListener(({ value: p }) => setShown(Math.round(value * p)));
    Animated.timing(t, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => setShown(value));
    return () => t.removeListener(id);
  }, [value]);
  return <Money value={shown} {...rest} />;
}

// Section: small header, dark card, optional footer note.
export function Group({ title, action, footer, children }: { title?: string; action?: ReactNode; footer?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      {(title || action) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
          <Text style={s.groupTitle}>{title}</Text>
          {action}
        </View>
      )}
      <View style={s.group}>{children}</View>
      {!!footer && <Text style={s.footer}>{footer}</Text>}
    </View>
  );
}

export function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [s.textAction, pressed && { opacity: 0.6 }]}>
      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

// Rounded icon on a tinted background of its own colour.
export function Tile({ icon, color, size = 36 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.52} color={color} />
    </View>
  );
}

export function Row({ icon, color = colors.accent, label, sub, value, valueColor, valueNode, onPress, danger, last, chevron = !!onPress }: {
  icon?: IconName; color?: string; label: string; sub?: string; value?: string; valueColor?: string; valueNode?: ReactNode;
  onPress?: () => void; danger?: boolean; last?: boolean; chevron?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.pressed }]}>
      {icon && <Tile icon={icon} color={danger ? colors.red : color} />}
      <View style={[s.rowBody, !last && s.rowSeparator]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowLabel, danger && { color: colors.red }]} numberOfLines={1}>{label}</Text>
          {!!sub && <Text style={s.rowSub} numberOfLines={1}>{sub}</Text>}
        </View>
        {!!value && <Text style={[s.rowValue, valueColor && { color: valueColor, fontWeight: '700' }]}>{value}</Text>}
        {valueNode}
        {chevron && <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
      </View>
    </Pressable>
  );
}

// showDate: for lists that span many days (e.g. a person's page).
export function EntryRow({ e, last, showDate }: { e: Entry; last?: boolean; showDate?: boolean }) {
  const dir = direction(e);
  const style = entryStyle(e);
  const p = e.person;
  const title =
    e.type === 'transfer' ? `${e.account} → ${e.to_account}`
    : e.type === 'lend' ? `Lent to ${p}`
    : e.type === 'repay' ? `${p} paid back`
    : p && !e.category ? (e.type === 'expense' ? `Sent to ${p}` : `Received from ${p}`)
    : p ? `${e.category} · ${p}`
    : e.category ?? e.note ?? TYPE_LABEL[e.type];
  const sub = [showDate && dayLabel(e.date), e.type !== 'transfer' && e.account, e.note !== title && e.note].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/entry', params: { entry: JSON.stringify(e) } })}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.pressed }]}
    >
      <Tile icon={style.icon} color={style.color} size={42} />
      <View style={[s.rowBody, !last && s.rowSeparator]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowLabel, { fontWeight: '600' }]} numberOfLines={1}>{title}</Text>
          {!!sub && <Text style={s.rowSub} numberOfLines={1}>{sub}</Text>}
        </View>
        <Money value={e.amount} size={15.5} color={dir > 0 ? colors.green : dir < 0 ? colors.red : colors.text} />
      </View>
    </Pressable>
  );
}

// Bank-app style hidden amount: the real number's shape with every digit drawn as a dot,
// e.g. ₹1,06,735 -> "₹ ●,●●,●●●". Dots are real circles so they look clean in any font.
export function HiddenAmount({ amount, size = 16, color = colors.text }: { amount: number; size?: number; color?: string }) {
  const d = Math.max(5, Math.round(size * 0.3));
  const chars = inr(Math.round(amount)).replace(/\.\d+$/, '').split('');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityLabel="Amount hidden">
      {chars.map((c, i) =>
        /\d/.test(c)
          ? <View key={i} style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color, marginHorizontal: d * 0.28 }} />
          : <Text key={i} style={{ fontSize: size, fontWeight: '800', color, marginRight: c === '₹' ? d * 0.6 : 0 }}>{c}</Text>,
      )}
    </View>
  );
}

// Segmented control.
export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segTrack}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[s.seg, on && s.segOn]}>
            <Text style={[s.segText, on && { color: colors.onAccent, fontWeight: '700' }]} numberOfLines={1} adjustsFontSizeToFit>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Wrapping choice chips (no sideways swiping). `onCard` = placed on a card, so use a lighter fill.
export function Chips<T extends string | number>({ options, value, onChange, onCard }: {
  options: { value: T; label: string; color?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  onCard?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[s.chip, onCard && { backgroundColor: colors.elevated }, on && { backgroundColor: colors.accent }]}>
            <Text style={[s.chipText, on && { color: colors.onAccent, fontWeight: '700' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({ label, onPress, disabled, icon, kind = 'filled' }: {
  label: string; onPress: () => void; disabled?: boolean; icon?: IconName; kind?: 'filled' | 'tinted';
}) {
  const filled = kind === 'filled';
  const fg = filled ? colors.onAccent : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.button, !filled && { backgroundColor: colors.card }, (pressed || disabled) && { opacity: 0.55 }]}
    >
      {icon && <Ionicons name={icon} size={20} color={fg} />}
      <Text style={[s.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// Full-width action in its own card, label centred (e.g. Delete Entry, Log out).
export function CardAction({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.group, { paddingVertical: 16, alignItems: 'center' }, pressed && { backgroundColor: colors.pressed }]}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: danger ? colors.red : colors.accent }}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={[s.group, { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 6 }]}>
      <Tile icon={icon} color={colors.accent} size={56} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8 }}>{title}</Text>
      <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  eyebrow: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 2 },
  largeTitle: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.bg },
  navTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  navDone: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  card: { backgroundColor: colors.glass, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  group: { backgroundColor: colors.glass, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  groupTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  footer: { fontSize: 13, color: colors.muted, paddingHorizontal: 4, lineHeight: 18 },
  textAction: { backgroundColor: colors.accent + '1A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, gap: 12, minHeight: 56 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingRight: 16 },
  rowSeparator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  rowLabel: { fontSize: 15.5, color: colors.text },
  rowSub: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  rowValue: { fontSize: 15, color: colors.muted },
  amount: { fontSize: 15.5, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  segTrack: { flexDirection: 'row', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 4 },
  seg: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  segOn: { backgroundColor: colors.accent },
  segText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 14.5, color: colors.text, fontWeight: '500' },
  button: { flexDirection: 'row', gap: 8, backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  input: { fontSize: 16, color: colors.text, paddingVertical: 15, paddingHorizontal: 16 },
});
