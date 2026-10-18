import { describe, expect, it } from 'vitest';
import {
  WILAYAS,
  getCommune,
  getWilaya,
  haversineKm,
  isCommuneInWilaya,
  nearestCommune,
  placeName,
} from '../src/geo';

describe('référentiel géographique', () => {
  it('contient les 58 wilayas avec communes, noms FR/AR et centres', () => {
    expect(WILAYAS).toHaveLength(58);
    for (const w of WILAYAS) {
      expect(w.fr).toBeTruthy();
      expect(w.ar).toBeTruthy();
      expect(w.communes.length).toBeGreaterThan(0);
    }
    const total = WILAYAS.reduce((n, w) => n + w.communes.length, 0);
    expect(total).toBeGreaterThan(1500);
  });

  it('a des codes de commune uniques', () => {
    const codes = WILAYAS.flatMap((w) => w.communes.map((c) => c.code));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('retrouve wilayas et communes', () => {
    expect(getWilaya('16')?.fr).toBe('Alger');
    expect(placeName(getWilaya('31')!, 'ar')).toBe('وهران');
    expect(placeName(getWilaya('31')!, 'fr')).toBe('Oran');
    expect(getCommune('16001')?.wilayaCode).toBe('16');
    expect(isCommuneInWilaya('16001', '16')).toBe(true);
    expect(isCommuneInWilaya('16001', '31')).toBe(false);
    expect(getWilaya('99')).toBeUndefined();
  });

  it('calcule une distance Alger → Oran plausible', () => {
    const d = haversineKm(getWilaya('16')!.center, getWilaya('31')!.center);
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(370);
  });

  it("déduit la commune la plus proche d'un point", () => {
    expect(nearestCommune({ lat: 36.19, lng: 5.41 }).wilayaCode).toBe('19'); // Sétif
    expect(nearestCommune({ lat: 36.771, lng: 3.061 })).toEqual({
      wilayaCode: '16',
      communeCode: '16001',
    });
  });
});
