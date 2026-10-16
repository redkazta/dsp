using Microsoft.EntityFrameworkCore;
using Stripe;
using WildForgeLabs.Core.Entities;

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

    public async Task<PaymentResult> ProcessPaymentAsync(Guid orderId, string provider, decimal amount)
    {
        var order = await _context.Orders.FindAsync(orderId);
        if (order == null)
        {
            return PaymentResult.Failure("Order not found");
        }

        switch (provider.ToLower())
        {
            case "stripe":
                return await ProcessStripePaymentAsync(order, amount);
            case "mercadopago":
                return await ProcessMercadoPagoPaymentAsync(order, amount);
            case "conekta":
                return await ProcessConektaPaymentAsync(order, amount);
            default:
                return PaymentResult.Failure("Unsupported payment provider");
        }
    }

    private async Task<PaymentResult> ProcessStripePaymentAsync(Order order, decimal amount)
    {
        try
        {
            var options = new PaymentIntentCreateOptions
            {
                Amount = (long)(amount * 100), // Convert to cents
                Currency = "mxn",
                PaymentMethodTypes = new List<string> { "card" },
                Metadata = new Dictionary<string, string>
                {
                    { "order_id", order.Id.ToString() }
                }
            };

            var service = new PaymentIntentService();
            var paymentIntent = await service.CreateAsync(options);

            order.Status = "Paid";
            order.UpdatedAt = DateTime.UtcNow;

            _context.Orders.Update(order);
            await _context.SaveChangesAsync();

            return PaymentResult.Success(paymentIntent.Id, paymentIntent.Id);
        }
        catch (Exception ex)
        {
            return PaymentResult.Failure(ex.Message);
        }
    }

    public async Task HandleStripeWebhookAsync(string json)
    {
        var stripeEvent = EventUtility.ConstructEvent(json, Request.Headers["Stripe-Signature"], "your_stripe_secret_key");

        switch (stripeEvent.Type)
        {
            case "payment_intent.succeeded":
                var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
                await UpdateOrderStatusFromPaymentAsync(paymentIntent.Metadata["order_id"], "Paid");
                break;
            case "payment_intent.payment_failed":
                var failedPaymentIntent = stripeEvent.Data.Object as PaymentIntent;
                await UpdateOrderStatusFromPaymentAsync(failedPaymentIntent.Metadata["order_id"], "PaymentFailed");
                break;
        }
    }

    private async Task UpdateOrderStatusFromPaymentAsync(string orderId, string status)
    {
        var order = await _context.Orders.FindAsync(Guid.Parse(orderId));
        if (order != null)
        {
            order.Status = status;
            order.UpdatedAt = DateTime.UtcNow;
            _context.Orders.Update(order);
            await _context.SaveChangesAsync();
        }
    }
}
