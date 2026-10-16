using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WildForgeLabs.Core.Entities;
using WildForgeLabs.Core.Common;

namespace WildForgeLabs.Infrastructure.Data.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Description).HasMaxLength(2000);
        builder.Property(p => p.BasePrice).HasColumnType("decimal(10,2)");
        builder.Property(p => p.Cost).HasColumnType("decimal(10,2)");
        builder.Property(p => p.SKU).HasMaxLength(50);
        builder.Property(p => p.IsActive).HasDefaultValue(true);
        builder.Property(p => p.CreatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(p => p.UpdatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(p => p.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(p => p.SKU).IsUnique();
        builder.HasIndex(p => p.TenantId);
    }
}

public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        builder.ToTable("product_variants");
        builder.HasKey(pv => pv.Id);
        builder.HasOne(pv => pv.Product)
            .WithMany(p => p.Variants)
            .HasForeignKey(pv => pv.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Property(pv => pv.Name).IsRequired().HasMaxLength(100);
        builder.Property(pv => pv.Price).HasColumnType("decimal(10,2)");
        builder.Property(pv => pv.Stock).HasDefaultValue(0);
        builder.Property(pv => pv.CreatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(pv => pv.UpdatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(pv => pv.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(pv => pv.ProductId);
    }
}

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("categories");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Name).IsRequired().HasMaxLength(100);
        builder.Property(c => c.ParentCategoryId).IsRequired(false);
        builder.HasOne(c => c.ParentCategory)
            .WithMany()
            .HasForeignKey(c => c.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Property(c => c.CreatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(c => c.UpdatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(c => c.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(c => c.TenantId);
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(c => c.LastName).IsRequired().HasMaxLength(100);
        builder.Property(c => c.Email).HasMaxLength(255);
        builder.Property(c => c.Phone).HasMaxLength(50);
        builder.Property(c => c.CreatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(c => c.UpdatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(c => c.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(c => new { c.TenantId, c.Email }).IsUnique();
    }
}

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.TotalAmount).HasColumnType("decimal(10,2)");
        builder.Property(o => o.Status).HasMaxLength(50).HasDefaultValue("pending");
        builder.Property(o => o.CreatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(o => o.UpdatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(o => o.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(o => new { o.TenantId, o.Status });
        builder.HasIndex(o => o.CustomerId);
    }
}

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("order_items");
        builder.HasKey(oi => oi.Id);
        builder.HasOne(oi => oi.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(oi => oi.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(oi => oi.ProductVariant)
            .WithMany()
            .HasForeignKey(oi => oi.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Property(oi => oi.Quantity).IsRequired();
        builder.Property(oi => oi.UnitPrice).HasColumnType("decimal(10,2)");
        builder.Property(oi => oi.CreatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(oi => oi.UpdatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(oi => oi.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(oi => oi.OrderId);
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Amount).HasColumnType("decimal(10,2)");
        builder.Property(p => p.Provider).HasMaxLength(50);
        builder.Property(p => p.ProviderTransactionId).HasMaxLength(255);
        builder.Property(p => p.Status).HasMaxLength(50).HasDefaultValue("pending");
        builder.Property(p => p.CreatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(p => p.UpdatedAt).HasColumnType("timestamptz").HasDefaultValueSql("NOW()");
        builder.Property(p => p.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(p => p.OrderId);
        builder.HasIndex(p => p.TenantId);
    }
}