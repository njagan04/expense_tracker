import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Person } from '../lib/api';
import { ACCOUNT_COLORS, colors, inr } from '../lib/util';
import { Row, s } from './ui';

export function Avatar({ name, id, size = 40 }: { name: string; id: number; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const color = ACCOUNT_COLORS[id % ACCOUNT_COLORS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '26', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

// The "👥 Person" row used on entry forms. Tapping it opens the searchable picker sheet.
export function PersonField({ value, onChange, people, required, label = 'Person', last, showOwes }: {
  value: string;
  onChange: (name: string) => void;
  people: Person[];
  required?: boolean;
  label?: string;
  last?: boolean;
  showOwes?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Row
        icon="people"
        color={colors.violet}
        label={value || label}
        sub={value ? label : required ? 'Tap to choose' : 'Optional · tap to choose'}
        onPress={() => setOpen(true)}
        last={last}
      />
      <PersonSheet
        visible={open}
        people={people}
        selected={value}
        allowNone={!required}
        showOwes={showOwes}
        onClose={() => setOpen(false)}
        onPick={(name) => { onChange(name); setOpen(false); }}
      />
    </>
  );
}

// Bottom sheet: search box, matching people, "Add <name>" when the name is new, "No person" when optional.
function PersonSheet({ visible, people, selected, allowNone, showOwes, onClose, onPick }: {
  visible: boolean;
  people: Person[];
  selected: string;
  allowNone: boolean;
  showOwes?: boolean;
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const query = q.trim();
  const matches = people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const exact = people.some((p) => p.name.toLowerCase() === query.toLowerCase());

  const pick = (name: string) => { setQ(''); onPick(name); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding" style={{ maxHeight: '80%', backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 12 }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.faint }} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginVertical: 12 }}>Choose person</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.elevated, borderRadius: 16, paddingHorizontal: 14 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 }}
            placeholder="Search or type a new name"
            placeholderTextColor={colors.muted}
            value={q}
            onChangeText={setQ}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => query && pick(matches.length === 1 ? matches[0].name : query)}
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        <FlatList
          data={matches}
          keyExtractor={(p) => String(p.id)}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {!!query && !exact && (
                <SheetRow onPress={() => pick(query)}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + '26', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person-add" size={18} color={colors.accent} />
                  </View>
                  <Text style={[s.rowLabel, { flex: 1, color: colors.accent, fontWeight: '700' }]}>Add “{query}”</Text>
                </SheetRow>
              )}
              {allowNone && !query && (
                <SheetRow onPress={() => pick('')}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="remove" size={18} color={colors.muted} />
                  </View>
                  <Text style={[s.rowLabel, { flex: 1, color: colors.muted }]}>No person</Text>
                  {!selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                </SheetRow>
              )}
            </>
          }
          renderItem={({ item: p }) => (
            <SheetRow onPress={() => pick(p.name)}>
              <Avatar name={p.name} id={p.id} />
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, { fontWeight: '600' }]}>{p.name}</Text>
                {showOwes && p.owes > 0 && <Text style={s.rowSub}>Owes {inr(p.owes)}</Text>}
              </View>
              {p.name === selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
            </SheetRow>
          )}
          ListEmptyComponent={!query ? <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>No people yet. Type a name above to add one.</Text> : undefined}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetRow({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 10 }, pressed && { backgroundColor: colors.pressed }]}>
      {children}
    </Pressable>
  );
}
