import { describe, expect, it } from 'vitest';
import { escapeHtml, safeUrl } from '../src/lib/html';

describe('escapeHtml', () => {
  it('neutraliza etiquetas y comillas', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('escapa apóstrofes (nombres tipo O’Brien)', () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
  });

  it('trata null y undefined como vacío', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(0)).toBe('0');
  });
});

describe('safeUrl', () => {
  it('permite rutas y http(s)', () => {
    expect(safeUrl('/og-image.jpg')).toBe('/og-image.jpg');
    expect(safeUrl('https://cdn.example.com/a.webp')).toBe('https://cdn.example.com/a.webp');
  });

  it('bloquea javascript: y data: no imagen', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
    expect(safeUrl('  ')).toBe('');
  });
});
