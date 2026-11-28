import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El panel se usa desde el teléfono para revisar pedidos y mensajes. Estas
 * comprobaciones fijan las piezas que lo hacen usable en pantallas chicas:
 * pestañas con safe area, tarjetas que envuelven sus acciones y bandeja
 * maestro-detalle.
 */
const read = (rel: string) =>
  readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

describe('admin móvil', () => {
  const layout = read('layouts/AdminLayout.astro');

  it('reserva el safe area y centra el contenido', () => {
    expect(layout).toContain('admin-bottom-nav');
    expect(layout).toContain('env(safe-area-inset-bottom)');
    expect(layout).toContain('admin-main');
    expect(layout).toContain('mx-auto');
  });

  it('marca la pestaña activa y usa etiquetas cortas', () => {
    expect(layout).toContain('aria-current={isActive(item.href)');
    expect(layout).toContain('admin-tab');
    expect(layout).toContain("'Ajustes'");
  });

  it('las tarjetas de producto envuelven acciones en móvil', () => {
    const products = read('pages/admin/productos/index.astro');
    expect(products).toContain('flex flex-wrap items-center gap-3');
    expect(products).toContain('w-full flex flex-wrap gap-2 lg:w-auto');
    expect(products).toContain('flex-col sm:flex-row');
  });

  it('los mensajes usan lista o detalle a pantalla completa en móvil', () => {
    const messages = read('pages/admin/mensajes.astro');
    expect(messages).toContain('id="messages-grid"');
    expect(messages).toContain('.is-detail');
    expect(messages).toContain('data-back');
    expect(messages).toContain('min-h-[320px]');
  });

  it('la tabla de variantes se desplaza en vez de aplastarse', () => {
    const editor = read('pages/admin/productos/[id].astro');
    expect(editor).toContain('min-w-[560px]');
    expect(editor).toContain('Desliza para ver todas las columnas');
    expect(editor).toContain('grid-cols-2 sm:grid-cols-5');
  });

  it('la cabecera del pedido puede envolver el total', () => {
    const orders = read('pages/admin/pedidos.astro');
    expect(orders).toContain('flex-wrap: wrap');
    expect(orders).toContain('.order-head > :last-child');
  });
});
