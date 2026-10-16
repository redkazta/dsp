using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WildForgeLabs.Core.Entities;
using WildForgeLabs.Core.Common;

namespace WildForgeLabs.Infrastructure.Data;

public class WildForgeLabsDbContext : DbContext
{
    private readonly Guid? _tenantId;

    public WildForgeLabsDbContext(DbContextOptions<WildForgeLabsDbContext> options, IHttpContextAccessor httpContextAccessor = null)
        : base(options)
    {
        _tenantId = httpContextAccessor?.HttpContext?.GetTenantId() ?? Guid.Empty;
    }

    public DbSet<Tenant> Tenants { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<ProductVariant> ProductVariants { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
    public DbSet<Payment> Payments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Aplicar configuración específica de cada entidad
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WildForgeLabsDbContext).Assembly);

        // Filtros globales de multi-tenancy
        if (_tenantId.HasValue && _tenantId != Guid.Empty)
        {
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                if (entityType.ClrType.IsAssignableTo(typeof(ITenant)))
                {
                    var parameter = Expression.Parameter(entityType.ClrType, "e");
                    var tenantIdProperty = entityType.FindProperty("TenantId");
                    if (tenantIdProperty != null)
                    {
                        var tenantId = Expression.Property(parameter, tenantIdProperty.ClrType!);
                        var tenantIdLambda = Expression.Lambda(
                            Expression.Equal(tenantId, Expression.Constant(_tenantId)),
                            _tenantId);
                        modelBuilder.Entity(entityType.ClrType).HasQueryFilter(tenantIdLambda);
                    }
                }
            }
        }

        // Soft delete global
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (entityType.ClrType.IsAssignableTo(typeof(ISoftDelete)))
            {
                var parameter = Expression.Parameter(entityType.ClrType, "e");
                var isDeletedProperty = entityType.FindProperty("IsDeleted");
                if (isDeletedProperty != null)
                {
                    var isDeleted = Expression.Property(parameter, isDeletedProperty.ClrType!);
                    var isDeletedLambda = Expression.Lambda(
                        Expression.Equal(isDeleted, Expression.Constant(false)),
                        parameter);
                    modelBuilder.Entity(entityType.ClrType).HasQueryFilter(isDeletedLambda);
                }
            }
        }
    }
}