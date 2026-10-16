using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe.Checkout;
using WildForgeLabs.Core.DTOs;
using WildForgeLabs.Core.Interfaces;
using WildForgeLabs.Infrastructure.Services;

namespace WildForgeLabs.Api.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[Authorize]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly IOrderRepository _orderRepository;
    private readonly IUnitOfWork _unitOfWork;

    public PaymentsController(IPaymentService paymentService, IOrderRepository orderRepository, IUnitOfWork unitOfWork)
    {
        _paymentService = paymentService;
        _orderRepository = orderRepository;
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// Procesa un pago para un pedido
    /// </summary>
    [HttpPost("process")]
    [ProducesResponseType(typeof(CreatePaymentResponse), 200)]
    [ProducesResponseType(400)]
    public async Task<ActionResult<CreatePaymentResponse>> ProcessPayment([FromBody] CreatePaymentDto dto)
    {
        var order = await _orderRepository.GetByIdAsync(dto.OrderId);
        if (order == null || order.TenantId != User.GetTenantId())
            return NotFound("Order not found");

        if (order.Status != "Pending" && order.Status != "Confirmed")
            return BadRequest("Order is not in a payable state");

        // Procesar pago según el proveedor
        var result = await _paymentService.ProcessPaymentAsync(dto.OrderId, dto.Provider, dto.Amount);

        if (!result.Success)
            return BadRequest(result.ErrorMessage);

        // Guardar registro de pago
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = User.GetTenantId(),
            OrderId = dto.OrderId,
            Amount = dto.Amount,
            Provider = dto.Provider,
            ProviderTransactionId = result.ProviderTransactionId,
            Status = result.Status,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _paymentService.AddPaymentAsync(payment);
        await _unitOfWork.SaveChangesAsync();

        return Ok(new CreatePaymentResponse
        {
            PaymentUrl = result.PaymentUrl,
            ProviderTransactionId = result.ProviderTransactionId
        });
    }

    /// <summary>
    /// Endpoint para webhooks de Stripe
    /// </summary>
    [HttpPost("webhook/stripe")]
    [AllowAnonymous]
    public async Task<IActionResult> StripeWebhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        try
        {
            await _paymentService.HandleStripeWebhookAsync(json);
            return Ok();
        }
        catch (Exception ex)
        {
            // Log error
            return BadRequest($"Webhook error: {ex.Message}");
        }
    }

    /// <summary>
    /// Endpoint para webhooks de Mercado Pago
    /// </summary>
    [HttpPost("webhook/mercadopago")]
    [AllowAnonymous]
    public async Task<IActionResult> MercadoPagoWebhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        try
        {
            await _paymentService.HandleMercadoPagoWebhookAsync(json);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest($"Webhook error: {ex.Message}");
        }
    }
}