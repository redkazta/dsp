# WildForgeLabs - E-commerce SaaS Multi-tenant (Hybrid Architecture)

SaaS vertical para e-commerce + ERP integrado con arquitectura desacoplada:
- **Storefront (Cliente Final):** Astro + Supabase (SEO, velocidad, contenido estático)
- **ERP y Backend (Administración):** .NET 8 + Blazor + SQL Server (lógica de negocio, seguridad, multi-tenancy)

## Estructura del Proyecto

```
/WildForgeLabs
├── /src                     # Código fuente .NET (ERP/Admin)
│   ├── /Core                # Entidades, DTOs, interfaces, dominio
│   ├── /Infrastructure      # DbContext, repositorios, servicios
│   ├── /Api                 # Web API RESTful
│   └── /Web                 # Blazor WebAssembly (Admin Panel)
├── /storefront              # Proyecto Astro (Tienda pública)
├── /tests                   # Tests unitarios, integración, E2E
├── /docs                    # Documentación
├── /scripts                 # Scripts de despliegue, migraciones
└── /.github                 # GitHub Actions CI/CD
```

## Variables de entorno del storefront (`storefront/`)

En Vercel: **Settings → Environment Variables**. Las de servidor (sin prefijo
`PUBLIC_`) se marcan *Sensitive*.

### FedEx (envíos, solo servidor)

Obligatorias:

| Variable | Ejemplo |
|---|---|
| `FEDEX_CLIENT_ID` | `l1a2...` (Developer Portal) |
| `FEDEX_CLIENT_SECRET` | `x9y8...` |
| `FEDEX_ACCOUNT_NUMBER` | número de cuenta FedEx |
| `FEDEX_BASE_URL` | `https://apis-sandbox.fedex.com` (sandbox) o `https://apis.fedex.com` (producción) |
| `FEDEX_ORIGIN_ZIP` | `76104` |
| `FEDEX_ORIGIN_CITY` | `Fort Worth` |
| `FEDEX_ORIGIN_STATE` | `TX` |
| `FEDEX_ORIGIN_COUNTRY` | `US` |

Opcionales: `FEDEX_ORIGIN_ADDRESS`, `FEDEX_ORIGIN_COMPANY`, `FEDEX_ORIGIN_PHONE`.
Sin las credenciales o sin el origen completo, el checkout usa la tarifa plana y
no se puede generar guía. Detalle en [`docs/envios-fedex.md`](docs/envios-fedex.md).