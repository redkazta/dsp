import { describe, expect, it } from 'vitest';
import { passesLuhn, validateSimulatedCard } from '../src/lib/card';

const validCard = {
  number: '4242 4242 4242 4242',
  name: 'Angel Perez',
  expiry: '12/35',
  cvv: '123',
};

describe('passesLuhn', () => {
  it('acepta números válidos', () => {
    expect(passesLuhn('4242424242424242')).toBe(true);
    expect(passesLuhn('5555555555554444')).toBe(true);
  });

  it('rechaza números con dígito cambiado', () => {
    expect(passesLuhn('4242424242424243')).toBe(false);
  });
});

describe('validateSimulatedCard', () => {
  it('aprueba una tarjeta válida', () => {
    expect(validateSimulatedCard(validCard)).toEqual({ ok: true });
  });

  it('rechaza la tarjeta de prueba 4000...0002', () => {
    const result = validateSimulatedCard({ ...validCard, number: '4000000000000002' });
    expect(result.ok).toBe(false);
  });

  it('rechaza números de menos de 16 dígitos', () => {
    expect(validateSimulatedCard({ ...validCard, number: '4242 4242' }).ok).toBe(false);
  });

  it('rechaza tarjetas vencidas', () => {
    expect(validateSimulatedCard({ ...validCard, expiry: '01/20' }).ok).toBe(false);
  });

  it('exige nombre, vigencia y CVV', () => {
    expect(validateSimulatedCard({ ...validCard, name: '  ' }).ok).toBe(false);
    expect(validateSimulatedCard({ ...validCard, expiry: '1235' }).ok).toBe(false);
    expect(validateSimulatedCard({ ...validCard, cvv: '12' }).ok).toBe(false);
  });

  it('acepta CVV de 4 dígitos (AMEX)', () => {
    expect(validateSimulatedCard({ ...validCard, cvv: '1234' })).toEqual({ ok: true });
  });
});
