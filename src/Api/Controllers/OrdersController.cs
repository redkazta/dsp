using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WildForgeLabs.Core.DTOs;
using WildForgeLabs.Core.Interfaces;

namespace WildForgeLabs.Api.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderRepository _orderRepository;
    private readonly IUnitOfWork _unitOfWork;

    public OrdersController(IOrderRepository orderRepository, IUnitOfWork unitOfWork)
    {
        _orderRepository = orderRepository;
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// Lista de pedidos del tenant actual
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<Order>), 200)]
    public async Task<ActionResult<IEnumerable<Order>>> GetOrders()
    {
        var orders = await _orderRepository.GetByTenantAsync(User.GetTenantId());
        return Ok(orders);
    }

    /// <summary>
    /// Obtiene un pedido por ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(Order), 200)]
    [ProducesResponseType(404)]
    public async Task<ActionResult<Order>> GetOrder(Guid id)
    {
        var order = await _orderRepository.GetByIdAsync(id);
        if (order == null || order.TenantId != User.GetTenantId())
            return NotFound();

        return Ok(order);
    }

    /// <summary>
    /// Crea un nuevo pedido desde el carrito
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CreateOrderResponse), 201)]
    [ProducesResponseType(400)]
    public async Task<ActionResult<CreateOrderResponse>> CreateOrder([FromBody] CreateOrderDto dto)
    {
        var customerId = User.GetTenantId(); // En realidad debería ser el ID del cliente

        var order = new Order
        {
            Id = Guid.NewGuid(),
            TenantId = User.GetTenantId(),
            CustomerId = customerId,
            TotalAmount = 0, // Se calculará después de validar items
            Status = "Pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Validar items y calcular total
        foreach (var itemDto in dto.Items)
        {
            var variant = await _orderRepository.GetProductVariantAsync(itemDto.ProductVariantId);
            if (variant == null)
                return BadRequest($"Product variant {itemDto.ProductVariantId} not found");

            order.Items.Add(new OrderItem
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                ProductVariantId = itemDto.ProductVariantId,
                Quantity = itemDto.Quantity,
                UnitPrice = variant.Price,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });

            order.TotalAmount += variant.Price * itemDto.Quantity;
        }

        await _orderRepository.AddAsync(order);
        await _unitOfWork.SaveChangesAsync();

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, new CreateOrderResponse
        {
            OrderId = order.Id,
            TotalAmount = order.TotalAmount,
            Status = order.Status
        });
    }

    /// <summary>
    /// Actualiza el estatus de un pedido
    /// </summary>
    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(Order), 200)]
    [ProducesResponseType(404)]
    public async Task<ActionResult<Order>> UpdateOrderStatus(Guid id, [FromBody] UpdateOrderStatusDto dto)
    {
        var order = await _orderRepository.GetByIdAsync(id);
        if (order == null || order.TenantId != User.GetTenantId())
            return NotFound();

        order.Status = dto.Status;
        order.UpdatedAt = DateTime.UtcNow;

        await _orderRepository.UpdateAsync(order);
        await _unitOfWork.SaveChangesAsync();

        return Ok(order);
    }
}