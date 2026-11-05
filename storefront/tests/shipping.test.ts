import { describe, expect, it } from 'vitest';
import {
  chooseShippingOption,
  packagesFor,
  readShippingSelection,
} from '../src/lib/shipping';
import type { FedexRateOption } from '../src/lib/fedex';

const ground: FedexRateOption = {
  productCode: 'FEDEX_GROUND',
  productName: 'FedEx Ground',
  amount: 12.5,
  currency: 'USD',
  deliveryDate: '2026-11-10',
  estimatedDays: 3,
};

const twoDay: FedexRateOption = {
  productCode: 'FEDEX_2_DAY',
  productName: 'FedEx 2Day',
  amount: 24,
  currency: 'USD',
  deliveryDate: '2026-11-08',
  estimatedDays: 2,
};

const options = [ground, twoDay];

describe('chooseShippingOption', () => {
  it('sin selección cobra la primera opción (la más barata)', () => {
    expect(chooseShippingOption(options, null, false)).toEqual({
      status: 'ok',
      shipping: { productCode: 'FEDEX_GROUND', name: 'FedEx Ground', amount: 12.5 },
    });
  });

  it('acepta la selección cuando el precio coincide', () => {
    const choice = chooseShippingOption(
      options,
      { productCode: 'FEDEX_2_DAY', amount: 24 },
      false
    );

    expect(choice.status).toBe('ok');
    if (choice.status !== 'ok' || !choice.shipping) return;
    expect(choice.shipping).toEqual({
      productCode: 'FEDEX_2_DAY',
      name: 'FedEx 2Day',
      amount: 24,
    });
  });

  it('devuelve el nuevo precio cuando cambió y no se aceptó', () => {
    const choice = chooseShippingOption(
      options,
      { productCode: 'FEDEX_GROUND', amount: 9.99 },
      false
    );

    expect(choice).toEqual({
      status: 'changed',
      shipping: { productCode: 'FEDEX_GROUND', name: 'FedEx Ground', amount: 12.5 },
    });
  });

  it('cobra el precio del servidor cuando el cliente aceptó el cambio', () => {
    const choice = chooseShippingOption(
      options,
      { productCode: 'FEDEX_GROUND', amount: 9.99 },
      true
    );

    expect(choice.status).toBe('ok');
    if (choice.status !== 'ok' || !choice.shipping) return;
    expect(choice.shipping.amount).toBe(12.5);
  });

  it('si el servicio elegido ya no existe, usa el primero', () => {
    const choice = chooseShippingOption(
      options,
      { productCode: 'FEDEX_SMART_POST', amount: 5 },
      false
    );

    expect(choice.status).toBe('changed');
    if (choice.status !== 'changed') return;
    expect(choice.shipping.productCode).toBe('FEDEX_GROUND');
  });

  it('sin opciones no resuelve envío', () => {
    expect(chooseShippingOption([], null, false)).toEqual({ status: 'ok', shipping: null });
  });
});

describe('readShippingSelection', () => {
  it('lee productCode y amount válidos', () => {
    expect(readShippingSelection({ productCode: ' FEDEX_GROUND ', amount: '12.50' })).toEqual({
      productCode: 'FEDEX_GROUND',
      amount: 12.5,
    });
  });

  it('rechaza datos incompletos o inválidos', () => {
    expect(readShippingSelection(null)).toBeNull();
    expect(readShippingSelection({})).toBeNull();
    expect(readShippingSelection({ productCode: '' })).toBeNull();
    expect(readShippingSelection({ productCode: 'FEDEX_GROUND', amount: 'x' })).toBeNull();
    expect(readShippingSelection({ productCode: 'FEDEX_GROUND', amount: -1 })).toBeNull();
  });
});

describe('packagesFor', () => {
  it('crea un paquete por pieza y acota cantidades', () => {
    expect(packagesFor(3)).toHaveLength(3);
    expect(packagesFor(0)).toHaveLength(1);
    expect(packagesFor(500)).toHaveLength(99);
  });
});
