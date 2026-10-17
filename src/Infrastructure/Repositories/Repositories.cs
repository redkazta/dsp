using Microsoft.EntityFrameworkCore;
using WildForgeLabs.Core.DTOs;
using WildForgeLabs.Core.Entities;
using WildForgeLabs.Core.Interfaces;
using WildForgeLabs.Infrastructure.Data;

namespace WildForgeLabs.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly WildForgeLabsDbContext _context;
    public UnitOfWork(WildForgeLabsDbContext context) => _context = context;

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => _context.SaveChangesAsync(cancellationToken);
}

public class ProductRepository : IProductRepository
{
    private readonly WildForgeLabsDbContext _context;

    public ProductRepository(WildForgeLabsDbContext context) => _context = context;

    public async Task<GetProductListResponse> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? search = null,
        Guid? categoryId = null,
        decimal? minPrice = null,
        decimal? maxPrice = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Products.AsNoTracking().Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => EF.Functions.ILike(p.Name, $"%{search}%"));

        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId);

        if (minPrice.HasValue)
            query = query.Where(p => p.BasePrice >= minPrice);

        if (maxPrice.HasValue)
            query = query.Where(p => p.BasePrice <= maxPrice);

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProductDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description ?? string.Empty,
                BasePrice = p.BasePrice,
                SKU = p.Sku ?? string.Empty,
                IsActive = p.IsActive,
                Variants = p.Variants
                    .Where(v => !v.IsDeleted)
                    .Select(v => new ProductVariantDto
                    {
                        Id = v.Id,
                        Name = v.Name,
                        Price = v.Price,
                        Stock = v.Stock,
                    })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        return new GetProductListResponse
        {
            TotalCount = total,
            PageNumber = pageNumber,
            PageSize = pageSize,
            Items = items,
        };
    }

    public async Task<GetProductByIdResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var p = await _context.Products
            .AsNoTracking()
            .Include(x => x.Variants)
            .Include(x => x.Category)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (p == null) return null;

        return new GetProductByIdResponse
        {
            Product = new ProductDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description ?? string.Empty,
                BasePrice = p.BasePrice,
                SKU = p.Sku ?? string.Empty,
                IsActive = p.IsActive,
            },
            Variants = p.Variants
                .Where(v => !v.IsDeleted)
                .Select(v => new ProductVariantDto
                {
                    Id = v.Id,
                    Name = v.Name,
                    Price = v.Price,
                    Stock = v.Stock,
                })
                .ToList(),
            Categories = p.Category is null
                ? new List<CategoryDto>()
                : new List<CategoryDto>
                {
                    new() { Id = p.Category.Id, Name = p.Category.Name },
                },
            Tags = new List<TagDto>(),
        };
    }

    public async Task AddAsync(Product product, CancellationToken cancellationToken = default)
    {
        await _context.Products.AddAsync(product, cancellationToken);
    }

    public Task UpdateAsync(Product product, CancellationToken cancellationToken = default)
    {
        _context.Products.Update(product);
        return Task.CompletedTask;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product == null) return;

        product.IsDeleted = true;
        product.DeletedAt = DateTime.UtcNow;
    }
}

public class OrderRepository : IOrderRepository
{
    private readonly WildForgeLabsDbContext _context;
    public OrderRepository(WildForgeLabsDbContext context) => _context = context;

    public async Task<IEnumerable<Order>> GetAllAsync(CancellationToken cancellationToken = default)
        => await _context.Orders.AsNoTracking()
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<Order?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

    public async Task AddAsync(Order order, CancellationToken cancellationToken = default)
        => await _context.Orders.AddAsync(order, cancellationToken);

    public Task UpdateAsync(Order order, CancellationToken cancellationToken = default)
    {
        _context.Orders.Update(order);
        return Task.CompletedTask;
    }
}

public class CustomerRepository : ICustomerRepository, IUserRepository
{
    private readonly WildForgeLabsDbContext _context;
    public CustomerRepository(WildForgeLabsDbContext context) => _context = context;

    public async Task<IEnumerable<Customer>> GetAllAsync(CancellationToken cancellationToken = default)
        => await _context.Customers.AsNoTracking().ToListAsync(cancellationToken);

    public Task<Customer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.Customers.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task AddAsync(Customer customer, CancellationToken cancellationToken = default)
        => await _context.Customers.AddAsync(customer, cancellationToken);
}

public class PaymentRepository : IPaymentRepository
{
    private readonly WildForgeLabsDbContext _context;
    public PaymentRepository(WildForgeLabsDbContext context) => _context = context;

    public async Task<IEnumerable<Payment>> GetAllAsync(CancellationToken cancellationToken = default)
        => await _context.Payments.AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<Payment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.Payments.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public async Task AddAsync(Payment payment, CancellationToken cancellationToken = default)
        => await _context.Payments.AddAsync(payment, cancellationToken);
}
