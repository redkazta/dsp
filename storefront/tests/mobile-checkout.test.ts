import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El flujo de compra en móvil tiene que caber en un pulgar.
 *
 * Estas pruebas vigilan las piezas que sostienen eso: barra fija con el
 * total, resumen compacto y miniaturas de lo que se está comprando. Si
 * alguien vuelve a dejar el checkout como una columna de texto sin fotos,
 * esto falla antes del deploy.
 */
const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

describe('checkout móvil', () => {
  const checkout = read('components/checkout/CheckoutPage.astro');

  it('muestra la miniatura de cada pieza en el resumen', () => {
    expect(checkout).toContain('safeUrl(i.image)');
    expect(checkout).toContain('object-contain');
  });

  it('tiene resumen plegable y barra fija con el total', () => {
    expect(checkout).toContain('id="co-summary"');
    expect(checkout).toContain('id="checkout-mobile-bar"');
    expect(checkout).toContain('id="bar-total"');
    expect(checkout).toContain('id="bar-cta"');
  });

  it('la barra continúa o paga según el paso', () => {
    expect(checkout).toContain('requestSubmit()');
    expect(checkout).toContain('goToStep(currentStep + 1)');
  });
});

describe('carrito móvil', () => {
  const cart = read('pages/carrito.astro');

  it('la pieza se apila en dos filas en pantallas chicas', () => {
    expect(cart).toContain('grid-cols-[64px_minmax(0,1fr)_auto]');
    expect(cart).toContain('row-span-2');
  });

  it('lleva total y pago a una barra fija', () => {
    expect(cart).toContain('id="cart-mobile-bar"');
    expect(cart).toContain('id="bar-total"');
  });
});

describe('ficha de producto móvil', () => {
  const pdp = read('pages/producto/[slug].astro');

  it('tiene barra fija para añadir sin subir a buscar el botón', () => {
    expect(pdp).toContain('id="pdp-mobile-bar"');
    expect(pdp).toContain('data-mobile-add');
  });

  it('respeta el selector de talla antes de añadir', () => {
    expect(pdp).toContain("document.querySelector('.size-btn.border-oro-brillo')");
  });
});

describe('base compartida', () => {
  const css = read('styles/global.css');

  it('define la barra móvil y reserva su alto', () => {
    expect(css).toContain('.mobile-bar');
    expect(css).toContain('body:has(.mobile-bar)');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });
});
