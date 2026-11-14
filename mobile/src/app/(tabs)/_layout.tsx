import { Pressable, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type IconName } from '../../lib/util';

// The active tab is shown by its icon turning violet (and filled).
const icon = (name: IconName, active: IconName) => ({ focused }: { focused: boolean }) =>
  <Ionicons name={focused ? active : name} size={23} color={focused ? colors.accent : colors.muted} />;

// Floating dark tab bar with a violet "+" in the middle.
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          position: 'absolute',
          bottom: insets.bottom + 10,
          marginHorizontal: 14,
          height: 66,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 33,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: '#14141D',
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="people" options={{ title: 'People', tabBarIcon: icon('people-outline', 'people') }} />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Pressable
                onPress={() => router.push('/entry')}
                style={({ pressed }) => [{
                  width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                }, pressed && { transform: [{ scale: 0.92 }] }]}
              >
                <Ionicons name="add" size={30} color={colors.onAccent} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('stats-chart-outline', 'stats-chart') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('receipt-outline', 'receipt') }} />
    </Tabs>
  );
}
