import { describe, expect, it } from 'vitest';
import {
  ROUTES,
  aliasToCanonical,
  canonicalPath,
  localize,
  localizedAliases,
  translateUrl,
} from '../src/lib/routes';

/**
 * Rutas localizadas ES/EN.
 *
 * Hay un solo archivo por página; el middleware reescribe `/shop` a
 * `/tienda`. Estos tests fijan que la tabla y las funciones de traducción
 * no se desincronicen.
 */
describe('ROUTES', () => {
  it('cada entrada tiene una ruta para cada idioma', () => {
    for (const [key, entry] of Object.entries(ROUTES)) {
      expect(entry.es, key).toMatch(/^\//);
      expect(entry.en, key).toMatch(/^\//);
    }
  });

  it('el español es el idioma con archivo real en src/pages', () => {
    // Las canónicas no pueden llevar el parámetro literal en el nombre.
    expect(ROUTES.shop.es).toBe('/tienda');
    expect(ROUTES.contact.es).toBe('/contacto');
  });

  it('no hay dos rutas con el mismo alias', () => {
    const aliases = Object.values(ROUTES).map((r) => r.en);
    expect(new Set(aliases).size).toBe(aliases.length);
  });
});

describe('aliasToCanonical', () => {
  it('traduce las rutas EN a su archivo canónico', () => {
    expect(aliasToCanonical('/shop')).toBe('/tienda');
    expect(aliasToCanonical('/contact')).toBe('/contacto');
    expect(aliasToCanonical('/about')).toBe('/nosotros');
    expect(aliasToCanonical('/cart')).toBe('/carrito');
    expect(aliasToCanonical('/favorites')).toBe('/favoritos');
    expect(aliasToCanonical('/login')).toBe('/entrar');
  });

  it('traduce rutas con parámetro', () => {
    expect(aliasToCanonical('/product/camisa-dsp-v3-violet')).toBe(
      '/producto/camisa-dsp-v3-violet'
    );
  });

  it('ignora la barra final', () => {
    expect(aliasToCanonical('/shop/')).toBe('/tienda');
    expect(aliasToCanonical('/contact/')).toBe('/contacto');
  });

  it('devuelve null para las canónicas y rutas ajenas', () => {
    expect(aliasToCanonical('/tienda')).toBeNull();
    expect(aliasToCanonical('/contacto')).toBeNull();
    expect(aliasToCanonical('/api/wishlist')).toBeNull();
    expect(aliasToCanonical('/cuenta')).toBeNull();
    expect(aliasToCanonical('/')).toBeNull();
    expect(aliasToCanonical('/product')).toBeNull();
  });

  it('no confunde /product/x con /producto/x', () => {
    // Es justo el caso que rompería si se comparara con `startsWith`.
    expect(aliasToCanonical('/product/a')).toBe('/producto/a');
    expect(aliasToCanonical('/producto/a')).toBeNull();
  });
});

describe('canonicalPath', () => {
  it('deja las canónicas igual y traduce las alias', () => {
    expect(canonicalPath('/tienda')).toBe('/tienda');
    expect(canonicalPath('/shop')).toBe('/tienda');
    expect(canonicalPath('/product/x')).toBe('/producto/x');
  });
});

describe('localize', () => {
  it('devuelve la ruta del idioma pedido', () => {
    expect(localize('es', 'shop')).toBe('/tienda');
    expect(localize('en', 'shop')).toBe('/shop');
    expect(localize('en', 'contact')).toBe('/contact');
    expect(localize('es', 'contact')).toBe('/contacto');
  });

  it('cae al español si el idioma no es válido', () => {
    expect(localize(null, 'shop')).toBe('/tienda');
    expect(localize('fr', 'shop')).toBe('/tienda');
  });

  it('sustituye el parámetro de ruta', () => {
    expect(localize('en', 'products', 'camisa-violet')).toBe('/product/camisa-violet');
    expect(localize('es', 'products', 'camisa-violet')).toBe('/producto/camisa-violet');
  });

  it('escapa el parámetro y conserva la query', () => {
    expect(localize('en', 'products', 'a b')).toBe('/product/a%20b');
    expect(localize('en', 'shop', null, '?sort=newest')).toBe('/shop?sort=newest');
    expect(localize('en', 'shop', null, 'sort=newest')).toBe('/shop?sort=newest');
  });
});

describe('translateUrl', () => {
  it('lleva a la misma página en el otro idioma (conmutador)', () => {
    expect(translateUrl('en', '/tienda')).toBe('/shop');
    expect(translateUrl('en', '/tienda?sort=newest')).toBe('/shop?sort=newest');
    expect(translateUrl('es', '/shop')).toBe('/tienda');
    expect(translateUrl('en', '/producto/x')).toBe('/product/x');
    expect(translateUrl('es', '/product/x')).toBe('/producto/x');
  });

  it('no toca rutas que no están en el mapa', () => {
    expect(translateUrl('en', '/cuenta')).toBe('/cuenta');
    expect(translateUrl('en', '/api/x')).toBe('/api/x');
    expect(translateUrl('en', '/')).toBe('/');
  });
});

describe('localizedAliases', () => {
  it('genera un alias por cada ruta traducible', () => {
    const aliases = localizedAliases();
    expect(aliases.length).toBe(Object.keys(ROUTES).length);

    const shop = aliases.find((a) => a.alias === '/shop');
    expect(shop?.target).toBe('/tienda');

    const product = aliases.find((a) => a.alias === '/product/*');
    expect(product?.target).toBe('/producto/*');
  });
});
