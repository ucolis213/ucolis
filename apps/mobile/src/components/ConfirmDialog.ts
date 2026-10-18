// Toute action destructive passe par cette confirmation.

import { Alert } from 'react-native';
import i18n from '../i18n';

export function confirm(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      opts.title,
      opts.message,
      [
        { text: i18n.t('common:cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: opts.confirmLabel ?? i18n.t('common:confirm'),
          style: opts.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function notify(title: string, message?: string) {
  Alert.alert(title, message);
}
