// Illustrations du site : fichiers PNG à générer (prompts dans apps/site/ILLUSTRATIONS.md), déposés dans
// public/illustrations/. Tant qu'un fichier manque, un emplacement réservé indique son nom.

export const ILLUSTRATIONS = {
  hero: { file: 'hero.png', ratio: '3 / 2' },
  senderPublish: { file: 'step-sender-1-publish.png', ratio: '1 / 1' },
  senderOffers: { file: 'step-sender-2-offers.png', ratio: '1 / 1' },
  senderTrack: { file: 'step-sender-3-track.png', ratio: '1 / 1' },
  senderHandover: { file: 'step-sender-4-handover.png', ratio: '1 / 1' },
  carrierProfile: { file: 'step-carrier-1-profile.png', ratio: '1 / 1' },
  carrierTrip: { file: 'step-carrier-2-trip.png', ratio: '1 / 1' },
  carrierOffer: { file: 'step-carrier-3-offer.png', ratio: '1 / 1' },
  carrierDeliver: { file: 'step-carrier-4-deliver.png', ratio: '1 / 1' },
  simulator: { file: 'simulator.png', ratio: '1 / 1' },
  trust: { file: 'trust.png', ratio: '1 / 1' },
  carriers: { file: 'carriers.png', ratio: '3 / 2' },
  pro: { file: 'pro.png', ratio: '3 / 2' },
  personaAmina: { file: 'persona-amina.png', ratio: '1 / 1' },
  personaKarim: { file: 'persona-karim.png', ratio: '1 / 1' },
  personaShop: { file: 'persona-shop.png', ratio: '1 / 1' },
  personaFleet: { file: 'persona-fleet.png', ratio: '1 / 1' },
  faq: { file: 'faq.png', ratio: '1 / 1' },
  download: { file: 'download.png', ratio: '2 / 3' },
  ogImage: { file: 'og-image.png', ratio: '1200 / 630' },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;
