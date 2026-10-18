import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICING } from '@ucolis/shared';
import { quotePrice } from '../src/modules/pricing/service';

describe('quotePrice', () => {
  it('donne un prix nul en distance pour un même point', () => {
    const p = { lat: 36.19, lng: 5.41 };
    const q = quotePrice(
      { pickup: p, dropoff: p, weightKg: 1, dimensionsCm: { length: 10, width: 10, height: 10 } },
      DEFAULT_PRICING,
    );
    expect(q).toEqual({ distanceKm: 0, volumeM3: 0.001, suggestedPrice: 650 });
  });
});
