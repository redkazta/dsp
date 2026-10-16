# WildForgeLabs - Documentación Técnica Completa

## 1. Arquitectura General

WildForgeLabs es una plataforma SaaS multi-tenant con arquitectura híbrida:

- **Storefront (Cliente Final):** Astro + Supabase
- **ERP/Admin (Dueño de Tienda):** .NET 8 + Blazor + SQL Server

### Estructura de Carpetas

```
/WildForgeLabs
├── /src
│   ├── /Core                    # Entidades, DTOs, interfaces, dominio
│   │   ├── /Entities            # Modelos de dominio
│   │   ├── /DTOs                # Data Transfer Objects
│   │   ├── /Interfaces          # Contratos de repositorios
│   │   └── /Common              # Interfaces compartidas
│   ├── /Infrastructure          # EF Core, repositorios, servicios
│   │   ├── /Data                # DbContext, configuraciones
│   │   ├── /Modules             # Módulos de negocio
│   │   │   ├── /Inventory
│   │   │   ├── /Sales
│   │   │   ├── /Shipping
│   │   │   ├── /Reports
│   │   │   └── /Notifications
│   │   └── /Services            # Servicios de negocio
│   ├── /Api                     # Web API RESTful
│   │   └── /Controllers         # Controladores REST
│   └── /Web                     # Blazor WebAssembly (Admin)
│       └── /Pages               # Páginas de administración
├── /storefront                  # Proyecto Astro (Tienda pública)
│   ├── /src
│   │   ├── /components          # Componentes React
│   │   ├── /layouts             # Layouts de Astro
│   │   ├── /pages               # Páginas de Astro
│   │   ├── /lib                 # Utilidades
│   │   └── /styles              # Estilos Tailwind
├── /tests                       # Tests unitarios e integración
├── /docs                        # Documentación
├── /scripts                     # Scripts de despliegue
└── /.github/workflows           # GitHub Actions CI/CD
```

## 2. Estrategia de Multi-Tenancy

### 2.1 Por Columna (TenantId)

**Ventajas:**
- Costos reducidos (una base de datos)
- Consultas transversales más fáciles
- Migraciones simplificadas
- Ideal para MVP y crecimiento inicial

**Desventajas:**
- Menor aislamiento entre tenants
- Escalabilidad limitada

### 2.2 Implementación

```csharp
public interface ITenant
{
    Guid TenantId { get; set; }
}

public interface ISoftDelete
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
}
```

**Filtro Global en DbContext:**

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    foreach (var entityType in modelBuilder.Model.GetEntityTypes())
    {
        if (entityType.ClrType.IsAssignableTo(typeof(ITenant)))
        {
            var parameter = Expression.Parameter(entityType.ClrType, "e");
            var tenantIdProperty = entityType.FindProperty("TenantId");
            var tenantId = Expression.Property(parameter, tenantIdProperty.ClrType!);
            var tenantIdLambda = Expression.Lambda(
                Expression.Equal(tenantId, Expression.Constant(_tenantId)),
                _tenantId);
            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(tenantIdLambda);
        }
    }
}
```

## 3. Endpoints RESTful

### 3.1 Productos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/products` | Lista paginada de productos |
| GET | `/api/v1/products/{id}` | Obtiene un producto por ID |
| POST | `/api/v1/products` | Crea un nuevo producto |
| PUT | `/api/v1/products/{id}` | Actualiza un producto |
| DELETE | `/api/v1/products/{id}` | Elimina un producto (soft delete) |

### 3.2 Pedidos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/orders` | Lista de pedidos |
| GET | `/api/v1/orders/{id}` | Obtiene un pedido por ID |
| POST | `/api/v1/orders` | Crea un nuevo pedido |
| PUT | `/api/v1/orders/{id}/status` | Actualiza el estatus de un pedido |

### 3.3 Pagos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/payments/process` | Procesa un pago |
| POST | `/api/v1/payments/webhook/stripe` | Webhook de Stripe |
| POST | `/api/v1/payments/webhook/mercadopago` | Webhook de Mercado Pago |

## 4. Autenticación y Autorización

### 4.1 JWT

```csharp
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidAudience = configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(configuration["Jwt:Key"]))
        };
    });
```

### 4.2 Políticas de Autorización

```csharp
services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));
    options.AddPolicy("TenantAdmin", policy =>
        policy.RequireClaim("tenantId"));
});
```

## 5. Estrategia de Sincronización con Supabase

### 5.1 Qué datos en Supabase

- Catálogo de productos (nombre, descripción, precio, stock disponible)
- Imágenes de productos
- Categorías y tags
- Información pública de la tienda

### 5.2 Qué datos NO en Supabase

- Datos de clientes (GDPR/CCPA)
- Pedidos y pagos
- Información confidencial

### 5.3 Estrategia de Sincronización

**Opción A: Webhooks de SQL Server**
- Usar triggers en SQL Server para enviar cambios a Supabase

**Opción B: Jobs Programados**
- Un job en .NET que sincroniza datos cada X minutos

**Opción C: Change Data Capture**
- Usar CDC de SQL Server para detectar cambios

## 6. Estrategia de Precios para el SaaS

| Plan | Precio Mensual | Límites |
|------|---------------|---------|
| Free | $0 | 10 productos, 50 pedidos/mes |
| Basic | $29 | 100 productos, 500 pedidos/mes |
| Professional | $79 | 1000 productos, 5000 pedidos/mes |
| Enterprise | $199 | Productos ilimitados, pedidos ilimitados |

## 7. Roadmap por Fases

### Fase 0: Fundación (2-3 semanas)
- Setup de solución .NET
- EF Core y DbContext
- Autenticación JWT
- Multi-tenancy básico
- Setup de Astro + Supabase
- Diseño de BD en SQL Server

### Fase 1: Productos e Inventario (3-4 semanas)
- CRUD de productos
- Variantes de productos
- Gestión de inventario
- Alertas de stock bajo

### Fase 2: Storefront en Astro (3-4 semanas)
- Catálogo de productos
- Detalle de producto
- SEO técnico
- Integración con Supabase

### Fase 3: Carrito y Checkout (3-4 semanas)
- Carrito persistente
- Checkout con Stripe/Mercado Pago
- Validación de inventario

### Fase 4: Pedidos y Estatus (2-3 semanas)
- Gestión de pedidos
- Flujo de estatus
- Tracking de envíos

### Fase 5: Panel de Administración (4-5 semanas)
- Dashboard Blazor
- Gestión de productos
- Gestión de pedidos
- Gestión de clientes

### Fase 6: Reportes y Analíticas (3-4 semanas)
- Reportes de ventas
- Analíticas de productos
- Gráficas y KPIs

### Fase 7: Multi-Tenant SaaS (4-5 semanas)
- Facturación de tenants
- Gestión de planes
- Onboarding de tenants
- Subdominios por tienda

### Fase 8: Integraciones Avanzadas (4-6 semanas)
- Paqueterías (FedEx, DHL, Estafeta)
- Facturación electrónica
- CRM básico

### Fase 9: App Móvil (6-8 semanas)
- Flutter o .NET MAUI
- Reutilización de API

## 8. Recomendaciones de Herramientas

### Backend (.NET)
- **Entity Framework Core:** ORM
- **FluentValidation:** Validación
- **MediatR:** CQRS ligero
- **Serilog:** Logging
- **Stripe.net:** Integración Stripe
- **Swashbuckle:** Swagger/OpenAPI

### Frontend (Blazor)
- **MudBlazor:** Componentes UI
- **Fluxor:** Gestión de estado
- **Chart.js:** Gráficas

### Storefront (Astro)
- **Astro:** Framework
- **Tailwind CSS:** Estilos
- **React:** Islas interactivas
- **Supabase:** Base de datos

### Testing
- **xUnit:** Tests unitarios
- **Moq:** Mocking
- **FluentAssertions:** Assertions
- **Playwright:** E2E

### DevOps
- **GitHub Actions:** CI/CD
- **Docker:** Contenedores
- **Azure App Service:** Hosting

## 9. Buenas Prácticas

1. **Separación de responsabilidades:** Cada proyecto tiene un propósito claro
2. **CQRS ligero:** Comandos y queries separados
3. **DTOs vs Entidades:** Nunca exponer entidades directamente
4. **Validación:** Validar en el borde (API, servicios)
5. **Manejo de errores:** Centralizado con ProblemDetails
6. **Logging:** Estructurado con Serilog
7. **Pruebas:** Cobertura mínima del 70-80%
8. **Documentación:** Swagger/OpenAPI actualizado

## 10. Errores Comunes y Cómo Evitarlos

### 10.1 N+1 Queries
**Problema:** Consultas innecesarias en bucles
**Solución:** Usar `.Include()` y `.AsNoTracking()`

### 10.2 DbContext en Scoped
**Problema:** DbContext compartido entre requests
**Solución:** Registrar como Scoped en DI

### 10.3 Multi-Tenancy Fugitiva
**Problema:** Datos de otro tenant accesibles
**Solución:** Filtros globales + validación en cada endpoint

### 10.4 Soft Delete Incompleto
**Problema:** Relaciones rotas por soft delete
**Solución:** Usar hard delete para relaciones o configurar OnDelete

### 10.5 Conexiones a BD
**Problema:** Conexiones no cerradas
**Solución:** Usar `using` y connection pooling

## 11. Escalabilidad de Monolito a Microservicios

### Señales de que es momento
- Un módulo crece desproporcionadamente
- Equipos independientes necesitan desplegar por separado
- Límites de escalabilidad del monolito

### Estrategia de Extracción
1. **Identificar el módulo** a extraer
2. **Crear una API independiente** para el módulo
3. **Migrar la base de datos** del módulo
4. **Actualizar el cliente** para llamar a la nueva API
5. **Desplegar de forma independiente**

### Patrones de Comunicación
- **Síncrono:** REST/gRPC para llamadas directas
- **Asíncrono:** Message Queue (RabbitMQ, Azure Service Bus) para eventos

## 12. Consideraciones de Costos

### Azure App Service
- **Básico:** ~$12/mes
- **Estándar:** ~$70/mes
- **Premium:** ~$140/mes

### VPS (DigitalOcean/Hetzner)
- **Básico:** ~$5/mes
- **Estándar:** ~$20/mes

### Supabase
- **Gratuito:** Hasta 500MB de base de datos
- **Pro:** $25/mes

### Vercel/Netlify
- **Gratuito:** Hasta cierto límite de uso
- **Pro:** ~$20/mes

## 13. Seguridad

### 13.1 HTTPS Obligatorio
- HSTS configurado
- Redirección automática de HTTP a HTTPS

### 13.2 Protección contra Ataques
- **SQL Injection:** Parameterized queries (EF Core)
- **XSS:** Sanitización de entrada
- **CSRF:** Tokens CSRF en formularios
- **Rate Limiting:** Por IP y por usuario

### 13.3 Gestión de Secretos
- **Desarrollo:** User Secrets
- **Producción:** Azure Key Vault / Variables de Entorno

## 14. Testing

### 14.1 Tests Unitarios
```csharp
[Fact]
public async Task ProcessPayment_WithValidOrder_ReturnsSuccess()
{
    // Arrange
    var order = new Order { Id = Guid.NewGuid(), TotalAmount = 100 };
    var mockRepository = new Mock<IOrderRepository>();
    mockRepository.Setup(r => r.GetByIdAsync(order.Id))
                  .ReturnsAsync(order);

    var service = new PaymentService(mockRepository.Object);

    // Act
    var result = await service.ProcessPaymentAsync(order.Id, "stripe", 100);

    // Assert
    Assert.True(result.Success);
}
```

### 14.2 Tests de Integración
```csharp
[Fact]
public async Task GetProducts_ReturnsPagedResult()
{
    // Arrange
    var client = CreateTestClient();

    // Act
    var response = await client.GetAsync("/api/v1/products?pageNumber=1&pageSize=20");

    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.OK);
}
```

## 15. Despliegue

### 15.1 Backend (.NET)
```bash
dotnet publish -c Release -o ./publish
docker build -t wildforgelabs-api .
docker push wildforgelabs-api
```

### 15.2 Frontend (Astro)
```bash
npm run build
# Subir a Vercel/Netlify
```

### 15.3 Base de Datos
- **SQL Server:** Azure SQL Database o VPS
- **Supabase:** Plan gratuito o Pro

## 16. Conclusión

WildForgeLabs está diseñado para escalar desde un MVP hasta una plataforma SaaS completa. La arquitectura híbrida permite:
- **Velocidad** en el storefront (Astro + Supabase)
- **Seguridad** en el backend (.NET + SQL Server)
- **Escalabilidad** mediante monolito modular

¡Éxito con tu proyecto!
