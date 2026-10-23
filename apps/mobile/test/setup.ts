import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NAMESPACES, resources } from '@ucolis/shared';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// SDK 58 (RN 0.88) : expo-asset lit AssetRegistry depuis le module privé de react-native,
// que jest-expo ne simule pas ; les polices d'icônes sont donc tenues pour déjà chargées.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(() => Promise.resolve()),
}));

i18n.use(initReactI18next).init({
  resources,
  lng: 'fr',
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  initAsync: false,
  showSupportNotice: false,
});
