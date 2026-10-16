/**
 * WildForgeLabs - Guía Rápida de Inicio Local
 * 
 * PASOS PARA OBSERVAR EL PROYECTO EN LOCAL (15 min)
 */

# 1. REQUISITOS PREVIOS
- .NET 8 SDK
- Node.js 18+
- Docker (para Supabase local) o cuenta Supabase cloud
- Git

# 2. CLONAR Y ESTRUCTURA
```bash
cd C:\Users\Angel\Desktop\DSP
# La estructura ya está creada
```

# 3. BASE DE DATOS (Supabase Local con Docker)
```bash
# Opción A: Supabase Local (recomendado para desarrollo)
docker run -d \
  --name supabase \
  -p 5432:5432 \
  -p 8000:8000 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=wildforgelabs \
  postgres:15

# Ejecutar schema
psql -h localhost -U postgres -d wildforgelabs -f scripts/supabase_schema.sql

# Opción B: Supabase Cloud (gratis)
# 1. Crear proyecto en supabase.com
# 2. Copiar URL y Anon Key
# 3. Ejecutar schema en SQL Editor
```

# 4. BACKEND .NET (API + Blazor)
```bash
# Restaurar paquetes
dotnet restore

# Crear migraciones
dotnet ef migrations add InitialCreate -p src/Infrastructure -s src/Api

# Aplicar migraciones
dotnet ef database update -p src/Infrastructure -s src/Api

# Ejecutar API
cd src/Api
dotnet run

# En otra terminal - Ejecutar Blazor Admin
cd src/Web
dotnet run
```

# 5. STOREFRONT ASTRO
```bash
cd storefront
npm install
npm run dev
# Abre http://localhost:4321
```

# 6. VARIABLES DE ENTORNO
Crear `.env` en `storefront/`:
```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_API_URL=http://localhost:5000/api/v1
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-...
```

Crear `appsettings.Development.json` en `src/Api/`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=wildforgelabs;Username=postgres;Password=postgres;Port=5432"
  },
  "Jwt": {
    "Key": "WildForgeLabsSecretKey2024!",
    "Issuer": "WildForgeLabs",
    "Audience": "WildForgeLabsClient",
    "ExpirationMinutes": 60
  }
}
```

# 7. VERIFICAR QUE FUNCIONA
- API: http://localhost:5000/swagger
- Blazor Admin: http://localhost:5001/admin
- Storefront: http://localhost:4321/tienda

# 8. COMANDOS ÚTILES
```bash
# Ver logs API
dotnet run --project src/Api --verbosity normal

# Nueva migración
dotnet ef migrations add NombreMigracion -p src/Infrastructure -s src/Api

# Build producción
dotnet publish src/Api -c Release -o ./publish
npm run build --prefix storefront
```

# 9. DEPLOY (cuando estés listo)
- **Storefront**: Conectar repo a Vercel → Deploy automático
- **API**: Conectar repo a Render → Web Service (Dockerfile)
- **Blazor**: Conectar repo a Render → Static Site
- **DB**: Supabase Cloud (gratis 500MB)
- **Keep-alive**: GitHub Actions ya configurado (.github/workflows/keep-alive.yml)

# 10. ESTRUCTURA FINAL
```
DSP/
├── src/
│   ├── Core/           # Entidades, DTOs, interfaces
│   ├── Infrastructure/ # EF Core, repositorios, configs
│   ├── Api/            # Web API RESTful
│   └── Web/            # Blazor WASM Admin
├── storefront/         # Astro + Tailwind + Supabase
├── scripts/            # SQL schema
├── .github/workflows/  # CI/CD + Keep-alive
└── docs/               # Documentación
```

# LISTO! 🚀