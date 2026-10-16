using Microsoft.EntityFrameworkCore;
using WildForgeLabs.Core.Entities;

namespace WildForgeLabs.Infrastructure.Data.Modules.Shipping;

public class ShippingRepository : IShippingRepository
{
    private readonly WildForgeLabsDbContext _context;

    public ShippingRepository(WildForgeLabsDbContext context)
    {
        _context = context;
    }

    public async Task<Shipment> GetShipmentByOrderIdAsync(Guid orderId)
    {
        return await _context.Shipments
            .FirstOrDefaultAsync(s => s.OrderId == orderId);
    }

    public async Task<IReadOnlyList<Shipment>> GetShipmentsByStatusAsync(string status)
    {
        return await _context.Shipments
            .Where(s => s.Status == status)
            .ToListAsync();
    }

    public async Task<Shipment> CreateShipmentAsync(Guid orderId, string carrier, string trackingNumber)
    {
        var shipment = new Shipment
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            Carrier = carrier,
            TrackingNumber = trackingNumber,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Shipments.Add(shipment);
        await _context.SaveChangesAsync();

        return shipment;
    }
}
