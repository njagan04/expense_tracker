import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, type Category } from '../lib/api';
import { categoryStyle, colors, showError, type IconName } from '../lib/util';
import { Group, Tile } from './ui';

const COLLAPSED = 5; // two rows of 4 = 5 categories + "Other" + "New" + "more" arrow

// Category grid that stays two rows tall however many categories exist.
// Order: your categories, then "Other", "New" and the more/less arrow at the end.
export function CategoryPicker({ categories, value, onChange, onCreated }: {
  categories: Category[];
  value: number | null;
  onChange: (id: number | null) => void;
  onCreated: (c: Category) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const other = categories.find((c) => /^others?$/i.test(c.name.trim()));
  const rest = categories.filter((c) => c !== other);
  const collapsible = rest.length > COLLAPSED;
  let visible = rest;
  if (collapsible && !expanded) {
    visible = rest.slice(0, COLLAPSED);
    const picked = rest.find((c) => c.id === value);
    if (picked && !visible.includes(picked)) visible = [...visible.slice(0, COLLAPSED - 1), picked]; // keep the selection in view
  }
  const hidden = rest.length - visible.length;
  const shown = other ? [...visible, other] : visible;

  const create = async () => {
    if (!name.trim()) return;
    try {
      const c = await api<Category>('/categories', 'POST', { name });
      onCreated(c);
      onChange(c.id);
      setName('');
      setAdding(false);
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Group title="Category">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8 }}>
        {shown.map((c) => {
          const st = categoryStyle(c.name);
          const on = c.id === value;
          return (
            <Cell key={c.id} label={c.name} active={on} onPress={() => onChange(on ? null : c.id)}>
              <View style={{ borderRadius: 18, padding: 3, borderWidth: 2, borderColor: on ? st.color : 'transparent' }}>
                <Tile icon={st.icon} color={st.color} size={44} />
              </View>
            </Cell>
          );
        })}
        <Cell label="New" onPress={() => setAdding((v) => !v)} active={adding}>
          <Ghost icon={adding ? 'close' : 'add'} highlight />
        </Cell>
        {collapsible && (
          <Cell label={expanded ? 'Less' : `${hidden} more`} onPress={() => setExpanded((v) => !v)}>
            <Ghost icon={expanded ? 'chevron-up' : 'chevron-down'} />
          </Cell>
        )}
      </View>

      {adding && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
          <Tile icon={categoryStyle(name || null).icon} color={name ? categoryStyle(name).color : colors.faint} />
          <TextInput
            style={{ flex: 1, fontSize: 16, color: colors.text, backgroundColor: colors.elevated, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}
            placeholder="New category name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            onSubmitEditing={create}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            autoCapitalize="words"
          />
          <Pressable onPress={create} disabled={!name.trim()} hitSlop={8}>
            <Ionicons name="checkmark-circle" size={34} color={name.trim() ? colors.accent : colors.faint} />
          </Pressable>
        </View>
      )}
    </Group>
  );
}

function Cell({ label, active, onPress, children }: { label: string; active?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: '25%', alignItems: 'center', paddingVertical: 8, gap: 6 }, pressed && { opacity: 0.6 }]}>
      {children}
      <Text style={{ fontSize: 12, color: active ? colors.text : colors.muted, fontWeight: active ? '700' : '500' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Ghost({ icon, highlight }: { icon: IconName; highlight?: boolean }) {
  return (
    <View style={{ padding: 3 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: highlight ? colors.accent : colors.faint, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={highlight ? colors.accent : colors.muted} />
      </View>
    </View>
  );
}
