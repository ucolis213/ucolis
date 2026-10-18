import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NAMESPACES, resources } from '@ucolis/shared';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

i18n.use(initReactI18next).init({
  resources,
  lng: 'fr',
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  initAsync: false,
  showSupportNotice: false,
});
