using Microsoft.EntityFrameworkCore;
using WildForgeLabs.Entities;

namespace WildForgeLabs
{
    public class WildForgeLabsDbContext : DbContext
    {
        public WildForgeLabsDbContext(DbContextOptions<WildForgeLabsDbContext> options) : base(options) { }

        public DbSet<Tenant> Tenants => Set<Tenant>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<User> Users => Set<User>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<OrderItem> OrderItems => Set<OrderItem>();
        public DbSet<Payment> Payments => Set<Payment>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Tenant>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Plan).HasDefaultValue("free");
            });

            modelBuilder.Entity<Product>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasOne(e => e.Tenant).WithMany(t => t.Products).HasForeignKey(e => e.TenantId);
                entity.HasIndex(e => new { e.TenantId, e.IsActive });
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}