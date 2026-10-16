using Microsoft.EntityFrameworkCore;
using WildForgeLabs.Core.Entities;

namespace WildForgeLabs.Infrastructure.Data.Modules.Inventory;

public class InventoryRepository : IInventoryRepository
{
    private readonly WildForgeLabsDbContext _context;

    public InventoryRepository(WildForgeLabsDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<ProductVariant>> GetVariantsByProductIdAsync(Guid productId)
    {
        return await _context.ProductVariants
            .Where(v => v.ProductId == productId)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ProductVariant>> GetLowStockVariantsAsync(int threshold = 5)
    {
        return await _context.ProductVariants
            .Where(v => v.Stock <= threshold)
            .ToListAsync();
    }

    public async Task<ProductVariant> GetVariantByIdAsync(Guid variantId)
    {
        return await _context.ProductVariants
            .Where(v => v.Id == variantId)
            .FirstOrDefaultAsync();
    }

    public async Task<IReadOnlyList<ProductVariant>> GetAllVariantsAsync()
    {
        return await _context.ProductVariants
            .Include(v => v.Category)
            .OrderBy(v => v.Name)
            .ToListAsync();
    }
}
