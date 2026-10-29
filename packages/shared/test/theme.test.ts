import { describe, expect, it } from 'vitest';
import { PARCEL_STATUSES } from '../src/enums';
import { DEFAULT_SETTINGS, APP_SETTING_SCHEMAS } from '../src/settings';
import {
  applyBrandColor,
  brandPalette,
  colors,
  contrastWithWhite,
  DEFAULT_PRIMARY_COLOR,
  isValidBrandColor,
  parcelStatusColors,
  space,
} from '../src/theme';

describe('jetons de design', () => {
  it('reprend les couleurs du PRD, avec le bleu comme couleur de marque par défaut', () => {
    expect(colors.primary).toBe('#1A73E8');
    expect(colors.navy).toBe('#0E1B3D');
    expect(colors.accent).toBe('#0EA5E9');
  });

  it('déclare une couleur pour chaque statut de colis', () => {
    PARCEL_STATUSES.forEach((s) => expect(parcelStatusColors[s]).toBeDefined());
  });

  it('espace par pas de 4', () => {
    expect(space(3)).toBe(12);
  });

  it('dérive les nuances de la couleur de marque et refuse les couleurs trop claires', () => {
    expect(brandPalette('#1A73E8')).toEqual({ primary: '#1A73E8', primaryDark: '#155EBE', primarySoft: '#E8F1FD' });
    expect(contrastWithWhite('#FFFFFF')).toBeCloseTo(1);
    expect(contrastWithWhite('#000000')).toBeCloseTo(21);
    expect(isValidBrandColor(DEFAULT_PRIMARY_COLOR)).toBe(true);
    expect(isValidBrandColor('#FFD700')).toBe(false);
    expect(isValidBrandColor('bleu')).toBe(false);
    expect(APP_SETTING_SCHEMAS.branding.safeParse(DEFAULT_SETTINGS.branding).success).toBe(true);
    expect(APP_SETTING_SCHEMAS.branding.safeParse({ primaryColor: '#FFFF00' }).success).toBe(false);
  });

  it('applique une couleur de marque aux jetons et au statut « ouverte »', () => {
    expect(applyBrandColor('#FFFF00')).toBe(false);
    expect(colors.primary).toBe('#1A73E8');
    expect(applyBrandColor('#0F766E')).toBe(true);
    expect(colors.primary).toBe('#0F766E');
    expect(parcelStatusColors.open.bg).toBe(colors.primarySoft);
    applyBrandColor(DEFAULT_PRIMARY_COLOR);
  });
});
