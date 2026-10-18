import { describe, expect, it } from 'vitest';
import { PARCEL_STATUSES } from '../src/enums';
import { colors, parcelStatusColors, space } from '../src/theme';

describe('jetons de design', () => {
  it('reprend les couleurs du PRD', () => {
    expect(colors.primary).toBe('#FF6B35');
    expect(colors.navy).toBe('#1C1C2E');
    expect(colors.accent).toBe('#4ECDC4');
  });

  it('déclare une couleur pour chaque statut de colis', () => {
    PARCEL_STATUSES.forEach((s) => expect(parcelStatusColors[s]).toBeDefined());
  });

  it('espace par pas de 4', () => {
    expect(space(3)).toBe(12);
  });
});
