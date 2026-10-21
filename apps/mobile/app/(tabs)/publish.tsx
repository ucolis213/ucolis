import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { GuestGate } from '@/components/GuestGate';
import { Screen } from '@/components/Screen';
import { useSession } from '@/session/SessionContext';
import { newParcelRoute } from '@/state/parcelDraft';
import { colors, forwardIcon, radii, shadow, space } from '@/theme';

export default function Publish() {
  const { t } = useTranslation();
  const { isGuest } = useSession();
  if (isGuest)
    return (
      <Screen>
        <GuestGate returnTo="/publish" />
      </Screen>
    );

  return (
    <Screen>
      <AppText size="xl" weight="bold">
        {t('publish.title')}
      </AppText>
      <Choice icon="cube" title={t('publish.parcel')} hint={t('publish.parcelHint')} onPress={() => router.push(newParcelRoute())} />
      <Choice
        icon="car"
        title={t('publish.trip')}
        hint={t('publish.tripHint')}
        onPress={() => router.push('/trip/new')}
      />
    </Screen>
  );
}

function Choice({ icon, title, hint, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.choice} accessibilityRole="button" accessibilityLabel={title}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText weight="bold">{title}</AppText>
        <AppText size="sm" color={colors.textMuted}>
          {hint}
        </AppText>
      </View>
      <Ionicons name={forwardIcon()} size={20} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space(4), padding: space(5), borderRadius: radii.card, backgroundColor: colors.surface, ...shadow },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
