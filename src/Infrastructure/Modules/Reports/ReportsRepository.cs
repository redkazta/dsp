using Microsoft.EntityFrameworkCore;
using WildForgeLabs.Core.Entities;

namespace WildForgeLabs.Infrastructure.Data.Modules.Reports;

public class ReportsRepository : IReportsRepository
{
    private readonly WildForgeLabsDbContext _context;

    public ReportsRepository(WildForgeLabsDbContext context)
    {
        _context = context;
    }

    public async Task<decimal> GetTotalRevenueAsync(DateTime startDate, DateTime endDate)
    {
        return await _context.Orders
            .Where(o => o.CreatedAt >= startDate && o.CreatedAt <= endDate)
            .SumAsync(o => o.TotalAmount);
    }

    public async Task<int> GetTotalOrdersAsync(DateTime startDate, DateTime endDate)
    {
        return await _context.Orders
            .Where(o => o.CreatedAt >= startDate && o.CreatedAt <= endDate)
            .CountAsync();
    }

    public async Task<decimal> GetAverageOrderValueAsync(DateTime startDate, DateTime endDate)
    {
        var totalRevenue = await GetTotalRevenueAsync(startDate, endDate);
        var totalOrders = await GetTotalOrdersAsync(startDate, endDate);

        return totalOrders > 0 ? totalRevenue / totalOrders : 0;
    }

    public async Task<IReadOnlyList<Product>> GetTopSellingProductsAsync(int limit = 10)
    {
        return await _context.Products
            .OrderByDescending(p => p.OrderItems.Sum(oi => oi.Quantity))
            .Take(limit)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ProductVariant>> GetLowStockProductsAsync(int threshold = 5)
    {
        return await _context.ProductVariants
            .Where(v => v.Stock <= threshold)
            .Include(v => v.Product)
            .OrderBy(v => v.Stock)
            .ToListAsync();
    }

    public async Task<decimal> GetProfitMarginAsync(DateTime startDate, DateTime endDate)
    {
        var totalRevenue = await _context.Orders
            .Where(o => o.CreatedAt >= startDate && o.CreatedAt <= endDate)
            .SumAsync(o => o.TotalAmount);

        var totalCost = await _context.OrderItems
            .Where(oi => oi.Order.CreatedAt >= startDate && oi.Order.CreatedAt <= endDate)
            .SumAsync(oi => oi.ProductVariant.Product.Cost * oi.Quantity);

        return totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0;
    }
}
