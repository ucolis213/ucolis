import { describe, expect, it } from 'vitest';
import {
  formatPhoneDz,
  formatPrice,
  maskEmail,
  maskPhone,
  maskPlate,
  normalizePhoneDz,
} from '../src/format';

describe('masquage', () => {
  it("masque l'email comme le PRD", () => {
    expect(maskEmail('amina@gmail.com')).toBe('a•••@gmail.com');
    expect(maskEmail('invalide')).toBe('•••');
  });

  it('masque le téléphone comme le PRD', () => {
    expect(maskPhone('+213551234512')).toBe('+213 5•• •• •• 12');
    expect(maskPhone('0551')).toBe('••••••');
  });

  it("ne garde que les 3 derniers chiffres de l'immatriculation", () => {
    expect(maskPlate('12345-116-16')).toBe('•••616');
  });
});

describe('téléphone algérien', () => {
  it.each([
    ['0551234567', '+213551234567'],
    ['551234567', '+213551234567'],
    ['+213 661 23 45 67', '+213661234567'],
    ['00213771234567', '+213771234567'],
  ])('normalise %s', (input, expected) => {
    expect(normalizePhoneDz(input)).toBe(expected);
  });

  it.each(['0451234567', '05512345', '+33612345678', 'abc'])('refuse %s', (input) => {
    expect(normalizePhoneDz(input)).toBeNull();
  });

  it("formate pour l'affichage", () => {
    expect(formatPhoneDz('+213551234512')).toBe('+213 551 23 45 12');
    expect(formatPhoneDz('x')).toBe('x');
  });
});

describe('montants', () => {
  it('affiche « 3 250 DA » et « 3 250 دج » avec des chiffres occidentaux', () => {
    expect(formatPrice(3250, 'fr')).toBe('3 250 DA');
    expect(formatPrice(3250, 'ar')).toBe('3 250 دج');
    expect(formatPrice(1250000, 'fr')).toBe('1 250 000 DA');
    expect(formatPrice(900, 'fr')).toBe('900 DA');
  });
});
