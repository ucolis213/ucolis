import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { TabBar, TabBarSpaceContext, tabBarSpace } from '@/components/TabBar';
import { useSocket } from '@/realtime/socket';

// Barre d'onglets dessinée par TabBar (forme, icônes, bouton Publier) ; ici, seulement les titres et la pastille.
// Elle flotte au-dessus des écrans : ils reçoivent la place à réserver en bas par TabBarSpaceContext.
export default function TabsLayout() {
  const { t } = useTranslation();
  const { counters } = useSocket();
  const insets = useSafeAreaInsets();
  return (
    <TabBarSpaceContext.Provider value={tabBarSpace(insets.bottom)}>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="home" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="listings" options={{ title: t('tabs.listings') }} />
        <Tabs.Screen name="publish" options={{ title: t('tabs.publish') }} />
        <Tabs.Screen
          name="messages"
          options={{
            title: t('tabs.messages'),
            tabBarBadge: counters.unreadMessages > 0 ? counters.unreadMessages : undefined,
          }}
        />
        <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      </Tabs>
    </TabBarSpaceContext.Provider>
  );
}
