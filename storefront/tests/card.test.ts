import { describe, expect, it } from 'vitest';
import { passesLuhn } from '../src/lib/card';

describe('passesLuhn', () => {
  it('acepta números válidos con y sin espacios', () => {
    expect(passesLuhn('4242424242424242')).toBe(true);
    expect(passesLuhn('4242 4242 4242 4242'.replace(/\s/g, ''))).toBe(true);
  });

  it('rechaza un dígito cambiado', () => {
    expect(passesLuhn('4242424242424241')).toBe(false);
  });

  it('rechaza entradas no numéricas o vacías', () => {
    expect(passesLuhn('')).toBe(false);
    expect(passesLuhn('4242a24242424242')).toBe(false);
  });
});
