// Requêtes TanStack Query : clés stables, pagination infinie pour les listes.

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  ConversationDto,
  DisputeDto,
  Me,
  MessageDto,
  NotificationDto,
  OfferDto,
  Paginated,
  ParcelCardDto,
  ParcelDto,
  PublicUser,
  ReviewDto,
  ReviewStatusDto,
  SavedSearchDto,
  TripDto,
  VehicleDto,
} from '@ucolis/shared';
import { useSession } from '../session/SessionContext';
import { api, qs } from './client';

const nextPage = <T,>(last: Paginated<T>) => (last.hasMore ? last.page + 1 : undefined);

export function useParcels(filters: Record<string, unknown>) {
  const { status } = useSession();
  return useInfiniteQuery({
    queryKey: ['parcels', filters, status],
    queryFn: ({ pageParam }) => api.get<Paginated<ParcelCardDto>>(`/parcels${qs({ ...filters, page: pageParam, limit: 20 })}`),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export function useParcel(id: string | undefined) {
  const { status } = useSession();
  return useQuery({
    queryKey: ['parcel', id, status],
    queryFn: () => api.get<ParcelDto>(`/parcels/${id}`),
    enabled: !!id && status !== 'loading',
  });
}

export function useMyParcels(statuses?: string) {
  return useInfiniteQuery({
    queryKey: ['me', 'parcels', statuses],
    queryFn: ({ pageParam }) => api.get<Paginated<ParcelCardDto>>(`/me/parcels${qs({ status: statuses, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export const useParcelOffers = (parcelId: string, sort: string) =>
  useQuery({
    queryKey: ['parcel', parcelId, 'offers', sort],
    queryFn: () => api.get<{ items: OfferDto[] }>(`/parcels/${parcelId}/offers${qs({ sort })}`),
  });

export type OfferDetail = OfferDto & { parcelTitle: string; parcelStatus: string; parcelRequestedPrice: number; viewerIsSender: boolean };
export const useOffer = (id: string) =>
  useQuery({ queryKey: ['offer', id], queryFn: () => api.get<OfferDetail>(`/offers/${id}`) });

export type MyOffer = OfferDto & { parcel: { id: string; title: string; status: string; from: { wilayaCode: string; commune: string }; to: { wilayaCode: string; commune: string }; desiredDate: string } | null };
export function useMyOffers(tab: string) {
  return useInfiniteQuery({
    queryKey: ['me', 'offers', tab],
    queryFn: ({ pageParam }) => api.get<Paginated<MyOffer>>(`/me/offers${qs({ tab, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export function useTrips(filters: Record<string, unknown>) {
  return useInfiniteQuery({
    queryKey: ['trips', filters],
    queryFn: ({ pageParam }) => api.get<Paginated<TripDto>>(`/trips${qs({ ...filters, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export const useTrip = (id: string) => useQuery({ queryKey: ['trip', id], queryFn: () => api.get<TripDto>(`/trips/${id}`) });
export const useMyTrips = () => useQuery({ queryKey: ['me', 'trips'], queryFn: () => api.get<{ items: TripDto[] }>('/me/trips') });
export const useMatchingParcels = (tripId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['trip', tripId, 'matching'],
    queryFn: () => api.get<{ items: ParcelCardDto[] }>(`/trips/${tripId}/matching-parcels`),
    enabled,
  });

export interface TripRequestDto {
  id: string;
  tripId: string;
  status: string;
  parcel: ParcelCardDto | null;
  createdAt: string;
}
export const useTripRequests = () =>
  useQuery({ queryKey: ['me', 'trip-requests'], queryFn: () => api.get<{ received: TripRequestDto[]; sent: TripRequestDto[] }>('/me/trip-requests') });

export const useConversations = (enabled = true) =>
  useQuery({ queryKey: ['conversations'], queryFn: () => api.get<{ items: ConversationDto[] }>('/conversations'), enabled });
export const useConversation = (id: string) =>
  useQuery({ queryKey: ['conversation', id], queryFn: () => api.get<ConversationDto>(`/conversations/${id}`) });

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      api.get<{ items: MessageDto[]; hasMore: boolean }>(`/conversations/${conversationId}/messages${qs({ before: pageParam })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items.at(-1)?.id : undefined),
  });
}

export function useNotifications(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) => api.get<Paginated<NotificationDto>>(`/notifications${qs({ page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled,
  });
}

export const usePublicUser = (id: string) => useQuery({ queryKey: ['user', id], queryFn: () => api.get<PublicUser>(`/users/${id}`) });
export const useUserReviews = (id: string) =>
  useQuery({ queryKey: ['user', id, 'reviews'], queryFn: () => api.get<Paginated<ReviewDto>>(`/users/${id}/reviews`) });
export const useUserTrips = (id: string) =>
  useQuery({ queryKey: ['user', id, 'trips'], queryFn: () => api.get<{ items: TripDto[] }>(`/users/${id}/trips`) });

export const useMyReviews = () =>
  useQuery({ queryKey: ['me', 'reviews'], queryFn: () => api.get<{ received: ReviewDto[]; given: ReviewDto[] }>('/me/reviews') });
export const useReviewStatus = (parcelId: string) =>
  useQuery({ queryKey: ['parcel', parcelId, 'review-status'], queryFn: () => api.get<ReviewStatusDto>(`/parcels/${parcelId}/review-status`) });
export const useFavorites = () =>
  useQuery({ queryKey: ['me', 'favorites'], queryFn: () => api.get<{ items: ParcelCardDto[] }>('/me/favorites') });
export const useSavedSearches = () =>
  useQuery({ queryKey: ['me', 'saved-searches'], queryFn: () => api.get<{ items: SavedSearchDto[] }>('/me/saved-searches') });
export const useVehicles = () => useQuery({ queryKey: ['me', 'vehicles'], queryFn: () => api.get<{ items: VehicleDto[] }>('/me/vehicles') });
export const useDispute = (id: string) => useQuery({ queryKey: ['dispute', id], queryFn: () => api.get<DisputeDto>(`/disputes/${id}`) });

export interface CarrierVerificationDto {
  status: Me['carrierVerification']['status'];
  decisionReason: string | null;
  submittedAt: string | null;
  licenseExpiresAt: string | null;
  insuranceExpiresAt: string | null;
  documents: Record<string, { kind: 'image' | 'pdf'; url: string } | null>;
}
export const useCarrierVerification = () =>
  useQuery({ queryKey: ['me', 'carrier-verification'], queryFn: () => api.get<CarrierVerificationDto>('/me/carrier-verification') });

export interface ProStatusDto {
  status: Me['pro']['status'];
  decisionReason: string | null;
  underReview: boolean;
  application: {
    companyName: string;
    legalForm: string;
    rcNumber: string;
    nif: string;
    nis: string | null;
    address: string;
    wilayaCode: string;
    commune: string;
  } | null;
}
export const usePro = () => useQuery({ queryKey: ['me', 'pro'], queryFn: () => api.get<ProStatusDto>('/me/pro') });

export interface ContentDto {
  key: string;
  locale: string;
  body: string;
  version: number;
  publishedAt: string;
}
export const useContent = (key: string, locale: string) =>
  useQuery({ queryKey: ['content', key, locale], queryFn: () => api.get<ContentDto>(`/content/${key}${qs({ locale })}`), retry: false });
