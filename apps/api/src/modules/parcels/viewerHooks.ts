// Informations du détail d'un colis qui dépendent d'autres modules (conversation, avis, litige, favori).
// Isolées ici pour éviter les dépendances circulaires entre modules.

import type { ParcelDto, ParcelViewerRole } from '@ucolis/shared';
import { FavoriteModel } from '../alerts/model';
import { ConversationModel } from '../conversations/model';
import { pairKeyOf } from '../conversations/service';
import { DisputeModel, ReviewModel } from '../trust/model';
import { hasRated } from '../trust/reviews';
import type { ParcelLean } from './model';

type Extras = Pick<ParcelDto['viewer'], 'hasReviewed' | 'conversationId' | 'openDisputeId'>;

export const parcelViewerHooks = {
  async run(p: ParcelLean, viewerId: string, role: ParcelViewerRole): Promise<Extras> {
    let conversationId: string | null = null;
    const counterpart =
      role === 'sender' ? p.assignedCarrier?.toString() : role === 'guest' || role === 'other' ? null : p.sender.toString();
    if (counterpart) {
      const conv = await ConversationModel.findOne({ pairKey: pairKeyOf(viewerId, counterpart), parcel: p._id }, { _id: 1 }).lean();
      conversationId = conv?._id.toString() ?? null;
    }
    const isParty = role === 'sender' || role === 'assigned_carrier';
    const [review, dispute] = isParty
      ? await Promise.all([
          ReviewModel.exists({ parcel: p._id, author: viewerId }),
          DisputeModel.findOne({ parcel: p._id, status: { $in: ['open', 'in_review'] } }, { _id: 1 }).lean(),
        ])
      : [null, null];
    // Une seule note par personne : déjà notée sur un autre colis, l'action « Noter » disparaît aussi.
    const hasReviewed = !!review || (isParty && !!counterpart && (await hasRated(viewerId, counterpart)));
    return { hasReviewed, conversationId, openDisputeId: dispute?._id.toString() ?? null };
  },
  /** Accès exceptionnel à un colis non public (ex. ancien offrant). */
  async canSee(_p: ParcelLean, _viewerId: string): Promise<boolean> {
    return false;
  },
  async isFavorite(parcelId: string, viewerId: string): Promise<boolean> {
    return !!(await FavoriteModel.exists({ parcel: parcelId, user: viewerId }));
  },
  async favoriteSet(parcelIds: string[], viewerId: string): Promise<Set<string>> {
    const favs = await FavoriteModel.find({ user: viewerId, parcel: { $in: parcelIds } }, { parcel: 1 }).lean();
    return new Set(favs.map((f) => f.parcel.toString()));
  },
};
