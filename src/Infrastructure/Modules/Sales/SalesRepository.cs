using Microsoft.EntityFrameworkCore;
using WildForgeLabs.Core.Entities;

namespace WildForgeLabs.Infrastructure.Data.Modules.Sales;

public class SalesRepository : ISalesRepository
{
    private readonly WildForgeLabsDbContext _context;

    public SalesRepository(WildForgeLabsDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Order>> GetOrdersByCustomerAsync(Guid customerId)
    {
        return await _context.Orders
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<Order>> GetOrdersByStatusAsync(string status)
    {
        return await _context.Orders
            .Where(o => o.Status == status)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<Order> GetOrderWithItemsAsync(Guid orderId)
    {
        return await _context.Orders
            .Include(o => o.Items)
            .ThenInclude(oi => oi.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .FirstOrDefaultAsync(o => o.Id == orderId);
    }

    public async Task<decimal> GetTotalSalesAsync(DateTime startDate, DateTime endDate)
    {
        return await _context.Orders
            .Where(o => o.CreatedAt >= startDate && o.CreatedAt <= endDate)
            .SumAsync(o => o.TotalAmount);
    }
}
