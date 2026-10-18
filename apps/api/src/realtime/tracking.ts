// Suivi GPS par socket : rooms tracking:<parcelId> réservées aux parties ; positions du transporteur
// acceptées seulement en in_transit, au plus une toutes les 5 s.

import type { Socket } from 'socket.io';
import { trackingPositionSchema } from '@ucolis/shared';
import type { Deps } from '../deps';
import { AppError } from '../lib/errors';
import { trackingRoom } from '../modules/tracking/service';
import type { Services } from '../services';
import { handle, type Ack } from './socket';

export function registerTrackingHandlers(socket: Socket, _deps: Deps, services: Services) {
  const userId = socket.data.userId as string;

  socket.on('tracking:join', (p: { parcelId: string }, ack?: Ack) =>
    handle(ack, async () => {
      await services.tracking.assertCanFollow(userId, String(p?.parcelId));
      await socket.join(trackingRoom(p.parcelId));
    }),
  );
  socket.on('tracking:leave', (p: { parcelId: string }, ack?: Ack) =>
    handle(ack, async () => {
      await socket.leave(trackingRoom(String(p?.parcelId)));
    }),
  );
  socket.on('tracking:position', (p: unknown, ack?: Ack) =>
    handle(ack, async () => {
      const parsed = trackingPositionSchema.safeParse(p);
      if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Position invalide');
      return services.tracking.record(userId, parsed.data);
    }),
  );
  socket.on('tracking:last', (p: { parcelId: string }, ack?: Ack) =>
    handle(ack, async () => {
      await services.tracking.assertCanFollow(userId, String(p?.parcelId));
      return services.tracking.last(p.parcelId);
    }),
  );
}
