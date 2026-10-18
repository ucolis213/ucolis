// Push par le service Expo. Les jetons rejetés (DeviceNotRegistered) sont supprimés.

import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { Logger } from 'pino';
import { PushTokenModel } from '../modules/push/model';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** Regroupement : threadId sur iOS, tag sur Android (ex. une conversation). */
  group?: string;
}

export interface PushSender {
  send(messages: PushMessage[]): Promise<void>;
}

export function createExpoPushSender(accessToken: string, logger: Logger): PushSender {
  const expo = new Expo({ accessToken: accessToken || undefined });
  return {
    async send(messages) {
      const valid = messages.filter((m) => Expo.isExpoPushToken(m.to));
      const invalid = messages.filter((m) => !Expo.isExpoPushToken(m.to)).map((m) => m.to);
      if (invalid.length) await PushTokenModel.deleteMany({ token: { $in: invalid } });
      const expoMessages: ExpoPushMessage[] = valid.map((m) => ({
        to: m.to,
        title: m.title,
        body: m.body,
        data: m.data,
        sound: 'default',
        ...(m.group ? { threadId: m.group, channelId: 'default' } : {}),
      }));
      for (const chunk of expo.chunkPushNotifications(expoMessages)) {
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          const dead = tickets
            .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? chunk[i]?.to : null))
            .flat()
            .filter((t): t is string => typeof t === 'string');
          if (dead.length) await PushTokenModel.deleteMany({ token: { $in: dead } });
        } catch (err) {
          logger.warn({ err }, 'envoi push en échec');
        }
      }
    },
  };
}

export function createMemoryPushSender() {
  const sent: PushMessage[] = [];
  return {
    sent,
    async send(messages: PushMessage[]) {
      sent.push(...messages);
    },
  };
}
