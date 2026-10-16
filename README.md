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