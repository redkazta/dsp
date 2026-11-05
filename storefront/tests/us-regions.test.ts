import { describe, expect, it } from 'vitest';
import {
  US_REGIONS,
  SHIPPING_REGIONS,
  isUsState,
  isUsShippingRegion,
  isUsPostalCode,
  usStateCode,
  usRegionName,
} from '../src/lib/us';

describe('catálogo de regiones', () => {
  it('tiene 50 estados + DC', () => {
    const states = US_REGIONS.filter((r) => r.type === 'state');
    const districts = US_REGIONS.filter((r) => r.type === 'district');

    expect(states).toHaveLength(50);
    expect(districts).toHaveLength(1);
    expect(districts[0].code).toBe('DC');
  });

  it('incluye los territorios con su flag', () => {
    const territories = US_REGIONS.filter((r) => r.type === 'territory').map((r) => r.code);

    expect(territories.sort()).toEqual(['AS', 'GU', 'MP', 'PR', 'VI']);
  });

  it('solo ofrece en checkout las regiones habilitadas', () => {
    const codes = SHIPPING_REGIONS.map((r) => r.code);

    expect(codes).toContain('CA');
    expect(codes).toContain('PR');
    expect(codes).not.toContain('AS');
    expect(codes).not.toContain('MP');
  });

  it('no repite códigos', () => {
    const codes = US_REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('validaciones de formato', () => {
  it('acepta código y nombre de estado', () => {
    expect(isUsState('ca')).toBe(true);
    expect(isUsState('California')).toBe(true);
    expect(isUsState('México')).toBe(false);
  });

  it('normaliza a código de dos letras', () => {
    expect(usStateCode('california')).toBe('CA');
    expect(usStateCode('PR')).toBe('PR');
    expect(usStateCode('nada')).toBe('');
  });

  it('bloquea regiones deshabilitadas para envío', () => {
    expect(isUsShippingRegion('CA')).toBe(true);
    expect(isUsShippingRegion('AS')).toBe(false);
  });

  it('valida ZIP de 5 o ZIP+4', () => {
    expect(isUsPostalCode('90210')).toBe(true);
    expect(isUsPostalCode('90210-1234')).toBe(true);
    expect(isUsPostalCode('9021')).toBe(false);
    expect(isUsPostalCode('90210-12')).toBe(false);
  });

  it('devuelve el nombre legible', () => {
    expect(usRegionName('ca')).toBe('California');
    expect(usRegionName('ZZ')).toBe('ZZ');
  });
});
