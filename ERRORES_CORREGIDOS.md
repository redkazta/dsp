# Errores corregidos en el proyecto DSP

## 1. Build error: "Cannot use \"||\" with \"??\" without parentheses"
- Archivo: `storefront/src/middleware.ts`
- Línea: 49
- Solución: Reemplazar `||` con `??` en la expresión de `firstName`
- Estado: ✅ Corregido (commit `9d2d54b`)

## 2. Build error: "Could not resolve \"../lib/auth\""
- Archivo: `storefront/src/components/auth/AuthForm.astro`
- Solución: Corregir import de `../../lib/auth`
- Estado: ✅ Corregido

## 3. Build error: "Expected \"(\" but found \"type\""
- Archivo: `storefront/src/pages/api/orders.ts`
- Solución: Agregar tipos explícitos a `request` y `cookies`
- Estado: ✅ Corregido

## 4. Build error: "Parameter 'c' implicitly has an 'any' type"
- Archivo: `storefront/src/lib/supabase-server.ts`
- Solución: Agregar tipo explícito `{ name: string; value: string }`
- Estado: ✅ Corregido

## 5. Build error: "Parameter 'o' implicitly has an 'any' type"
- Archivo: `storefront/src/lib/admin.ts`
- Solución: Agregar tipos explícitos en `.filter()` y `.reduce()`
- Estado: ✅ Corregido

## 6. Build error: "Could not resolve \"../../lib/supabase\""
- Archivo: `storefront/src/layouts/BaseLayout.astro`
- Línea: Script de sign out
- Solución: Corregir import a `../lib/supabase`
- Estado: ✅ Corregido (commit `e2a120d`)

## Regla para evitar repetir errores:
- Siempre usar `??` (nullish coalescing) para valores por defecto
- Nunca mezclar `??` con `||` sin paréntesis
- Siempre agregar tipos explícitos en TypeScript (`: any` o tipos específicos)
- Verificar rutas de importación: `../` sube un nivel, `../../` sube dos
