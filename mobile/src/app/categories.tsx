import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, type Summary } from '../lib/api';
import { categoryStyle, colors, showError } from '../lib/util';
import { Empty, Group, ModalScreen, s, Tile, useFocusData } from '../components/ui';

export default function Categories() {
  const { data, reload } = useFocusData(() => api<Summary>('/summary'));
  const [name, setName] = useState('');
  const categories = data?.categories ?? [];
  const preview = categoryStyle(name || null);

  const add = async () => {
    if (!name.trim()) return;
    try {
      await api('/categories', 'POST', { name });
      setName('');
      reload();
    } catch (e) {
      showError(e);
    }
  };

  const remove = (id: number, label: string) =>
    Alert.alert(`Delete "${label}"?`, 'Existing entries keep their amount but lose this category.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => api(`/categories?id=${id}`, 'DELETE').then(reload, showError) },
    ]);

  return (
    <ModalScreen title="Categories">
      <Group title="New category" footer="The icon and colour are picked from the name, e.g. “Fuel” gets a car.">
        <View style={s.row}>
          <Tile icon={preview.icon} color={name ? preview.color : colors.faint} />
          <View style={s.rowBody}>
            <TextInput
              style={{ flex: 1, fontSize: 16, color: colors.text }}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              onSubmitEditing={add}
              maxLength={40}
              returnKeyType="done"
            />
            <Pressable onPress={add} disabled={!name.trim()} hitSlop={10}>
              <Ionicons name="add-circle" size={28} color={name.trim() ? colors.accent : colors.faint} />
            </Pressable>
          </View>
        </View>
      </Group>

      {data && !categories.length ? (
        <Empty icon="pricetags-outline" title="No categories" text="Add one above." />
      ) : (
        <Group title={`${categories.length} categories`}>
          {categories.map((c, i) => {
            const st = categoryStyle(c.name);
            return (
              <View key={c.id} style={s.row}>
                <Tile icon={st.icon} color={st.color} />
                <View style={[s.rowBody, i < categories.length - 1 && s.rowSeparator]}>
                  <Text style={[s.rowLabel, { flex: 1 }]}>{c.name}</Text>
                  <Pressable onPress={() => remove(c.id, c.name)} hitSlop={12}>
                    <Ionicons name="remove-circle" size={24} color={colors.red} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Group>
      )}
    </ModalScreen>
  );
}
