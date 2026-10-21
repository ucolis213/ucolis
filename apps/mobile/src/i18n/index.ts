// i18n : français par défaut, arabe en RTL. Les ressources viennent de shared (mêmes clés que les push).

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import * as Updates from 'expo-updates';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager } from 'react-native';
import { DEFAULT_LOCALE, LOCALES, NAMESPACES, isRtl, resources, type Locale } from '@ucolis/shared';

const LANGUAGE_KEY = '@ucolis/language';
const RTL_RELOAD_KEY = '@ucolis/rtl_reload';

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

// Rechargement à chaud (développement) : i18next garde les traductions du démarrage, on y verse les nouvelles.
if (i18n.isInitialized) {
  for (const lng of LOCALES) {
    for (const ns of NAMESPACES) i18n.addResourceBundle(lng, ns, resources[lng][ns], true, true);
  }
}

/** Langue enregistrée, sinon celle de l'appareil si elle est prise en charge, sinon le français. */
export function pickLocale(stored: string | null, device: string | null | undefined): Locale {
  if (isLocale(stored)) return stored;
  if (isLocale(device)) return device;
  return DEFAULT_LOCALE;
}

async function reloadApp() {
  // En développement (Expo Go, build de dev), Updates.reloadAsync relance le runtime avant que les modules
  // natifs soient prêts (« Cannot find native module 'ExpoAsset' ») : on recharge depuis Metro.
  if (__DEV__) return DevSettings.reload();
  try {
    await Updates.reloadAsync();
  } catch {
    // Expo Go et le mode développement n'acceptent pas toujours reloadAsync.
    DevSettings.reload();
  }
}

/** Aligne la direction de l'interface sur la langue ; redémarre une seule fois si nécessaire. */
async function applyDirection(locale: Locale) {
  const wantRtl = isRtl(locale);
  if (I18nManager.isRTL === wantRtl) {
    await AsyncStorage.removeItem(RTL_RELOAD_KEY);
    return;
  }
  I18nManager.allowRTL(wantRtl);
  I18nManager.forceRTL(wantRtl);
  // Garde-fou : si la bascule n'a pas pris après un redémarrage, on n'insiste pas.
  if (await AsyncStorage.getItem(RTL_RELOAD_KEY)) return;
  await AsyncStorage.setItem(RTL_RELOAD_KEY, '1');
  await reloadApp();
}

export async function initI18n(): Promise<Locale> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  const locale = pickLocale(stored, Localization.getLocales()[0]?.languageCode);
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      showSupportNotice: false,
    });
  }
  await applyDirection(locale);
  return locale;
}

export async function changeLanguage(locale: Locale) {
  await AsyncStorage.setItem(LANGUAGE_KEY, locale);
  await AsyncStorage.removeItem(RTL_RELOAD_KEY);
  await i18n.changeLanguage(locale);
  await applyDirection(locale);
}

export const currentLocale = (): Locale =>
  isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;

export default i18n;
