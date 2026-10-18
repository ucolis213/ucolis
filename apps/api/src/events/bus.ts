// Bus d'événements de domaine. Les services émettent ; les abonnés (notifications, push, Socket.IO,
// correspondances) réagissent. Un abonné en échec est journalisé sans faire échouer l'écriture métier.

import type { Logger } from 'pino';
import type { DomainEvents } from './types';

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;

export class EventBus {
  private handlers = new Map<keyof DomainEvents, Handler<never>[]>();

  constructor(private logger?: Logger) {}

  on<K extends keyof DomainEvents>(type: K, handler: Handler<K>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(type, list);
  }

  /** À appeler après le commit de la transaction. Attend les abonnés (déterminisme des tests). */
  async emit<K extends keyof DomainEvents>(type: K, payload: DomainEvents[K]): Promise<void> {
    const list = (this.handlers.get(type) ?? []) as Handler<K>[];
    await Promise.all(
      list.map(async (h) => {
        try {
          await h(payload);
        } catch (err) {
          this.logger?.error({ err, event: type }, 'abonné en échec');
        }
      }),
    );
  }
}
