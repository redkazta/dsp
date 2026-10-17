using Microsoft.EntityFrameworkCore;
using Stripe;
using WildForgeLabs.Core.DTOs;
using WildForgeLabs.Core.Interfaces;
using WildForgeLabs.Infrastructure.Data;

namespace WildForgeLabs.Infrastructure.Services;

public class PaymentService : IPaymentService
{
    private readonly WildForgeLabsDbContext _context;
    private readonly StripeClient _stripeClient;

    public PaymentService(WildForgeLabsDbContext context, StripeClient stripeClient)
    {
        _context = context;
        _stripeClient = stripeClient;
    }

    public async Task<CreatePaymentResponse> CreatePaymentAsync(
        CreatePaymentDto dto,
        CancellationToken cancellationToken = default)
    {
        var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == dto.OrderId, cancellationToken);
        if (order == null)
            throw new InvalidOperationException($"Order {dto.OrderId} not found");

        if (!dto.Provider.Equals("stripe", StringComparison.OrdinalIgnoreCase))
            throw new NotSupportedException($"Provider '{dto.Provider}' not implemented yet");

        var options = new PaymentIntentCreateOptions
        {
            Amount = (long)(dto.Amount * 100), // cents
            Currency = "mxn",
            PaymentMethodTypes = new List<string> { "card" },
            Metadata = new Dictionary<string, string> { { "order_id", order.Id.ToString() } },
        };

        var service = new PaymentIntentService(_stripeClient);
        var intent = await service.CreateAsync(options, cancellationToken: cancellationToken);

        order.Status = "pending";
        order.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return new CreatePaymentResponse
        {
            ProviderTransactionId = intent.Id,
            PaymentUrl = intent.ClientSecret,
        };
    }
}
