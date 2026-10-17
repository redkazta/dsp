using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe.Checkout;
using WildForgeLabs.Core.DTOs;
using WildForgeLabs.Core.Interfaces;

namespace WildForgeLabs.Api.Controllers;

[ApiController]
[Route("api/v1/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IOrderRepository _orders;
    private readonly IConfiguration _config;

    public PaymentsController(IOrderRepository orders, IConfiguration config)
    {
        _orders = orders;
        _config = config;
    }

    /// <summary>
    /// Crea una sesión de Stripe Checkout y devuelve la URL de pago.
    /// </summary>
    [HttpPost("checkout")]
    [AllowAnonymous]
    [ProducesResponseType(200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> CreateCheckout([FromBody] CheckoutRequest request, CancellationToken ct)
    {
        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { error = "El carrito está vacío" });

        Stripe.StripeConfiguration.ApiKey = _config["Stripe:SecretKey"];

        var frontendUrl = _config["Frontend:Url"] ?? "https://dinerosobreproblemas.com";

        var options = new SessionCreateOptions
        {
            Mode = "payment",
            SuccessUrl = $"{frontendUrl}/confirmacion?session_id={{CHECKOUT_SESSION_ID}}",
            CancelUrl = $"{frontendUrl}/carrito",
            CustomerEmail = request.Customer?.GetValueOrDefault("email"),
            LineItems = request.Items.Select(i => new SessionLineItemOptions
            {
                Quantity = i.Qty,
                PriceData = new SessionLineItemPriceDataOptions
                {
                    Currency = "mxn",
                    UnitAmount = (long)(i.Price * 100),
                    ProductData = new SessionLineItemPriceDataProductDataOptions
                    {
                        Name = string.IsNullOrWhiteSpace(i.VariantName)
                            ? i.Name
                            : $"{i.Name} — {i.VariantName}",
                    },
                },
            }).ToList(),
            Metadata = new Dictionary<string, string>
            {
                { "customer_name", $"{request.Customer?.GetValueOrDefault("firstName")} {request.Customer?.GetValueOrDefault("lastName")}".Trim() },
                { "phone", request.Customer?.GetValueOrDefault("phone") ?? "" },
            },
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options, cancellationToken: ct);

        return Ok(new { url = session.Url, id = session.Id });
    }

    /// <summary>
    /// Webhook de Stripe.
    /// </summary>
    [HttpPost("webhook/stripe")]
    [AllowAnonymous]
    public async Task<IActionResult> StripeWebhook(CancellationToken ct)
    {
        var json = await new StreamReader(Request.Body).ReadToEndAsync(ct);
        var signature = Request.Headers["Stripe-Signature"].ToString();
        var secret = _config["Stripe:WebhookSecret"];

        if (string.IsNullOrWhiteSpace(secret) || secret.StartsWith("whsec_..."))
            return Ok(new { skipped = "webhook secret not configured" });

        try
        {
            var stripeEvent = Stripe.EventUtility.ConstructEvent(json, signature, secret);

            switch (stripeEvent.Type)
            {
                case "checkout.session.completed":
                case "payment_intent.succeeded":
                    // TODO: crear pedido + descontar stock
                    break;
                default:
                    break;
            }

            return Ok();
        }
        catch (Stripe.StripeException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

public class CheckoutRequest
{
    public Dictionary<string, string>? Customer { get; set; }
    public List<CheckoutItem> Items { get; set; } = new();
}

public class CheckoutItem
{
    public string VariantId { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string VariantName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Qty { get; set; } = 1;
}
