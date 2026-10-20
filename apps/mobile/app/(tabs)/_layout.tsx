import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/realtime/socket';
import { colors, fontFamily, shadow } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (name: IconName, active: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : name} size={24} color={color} />;
  };

export default function TabsLayout() {
  const { t } = useTranslation();
  const { counters } = useSocket();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontFamily: fontFamily('medium'), fontSize: 11 },
        tabBarStyle: { borderTopColor: colors.border, minHeight: 60 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="listings" options={{ title: t('tabs.listings'), tabBarIcon: icon('search-outline', 'search') }} />
      <Tabs.Screen
        name="publish"
        options={{
          title: t('tabs.publish'),
          tabBarIcon: function PublishIcon() {
            return (
              <View style={styles.publish}>
                <Ionicons name="add" size={30} color="#FFFFFF" />
              </View>
            );
          },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarIcon: icon('chatbubbles-outline', 'chatbubbles'),
          tabBarBadge: counters.unreadMessages > 0 ? counters.unreadMessages : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  publish: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadow,
  },
});
