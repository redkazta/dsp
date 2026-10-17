using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WildForgeLabs.Core.DTOs;
using WildForgeLabs.Core.Entities;
using WildForgeLabs.Core.Interfaces;

namespace WildForgeLabs.Api.Controllers;

[ApiController]
[Route("api/v1/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderRepository _orders;
    private readonly IUnitOfWork _uow;

    public OrdersController(IOrderRepository orders, IUnitOfWork uow)
    {
        _orders = orders;
        _uow = uow;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<Order>), 200)]
    public async Task<ActionResult<IEnumerable<Order>>> GetOrders(CancellationToken ct)
    {
        var orders = await _orders.GetAllAsync(ct);
        return Ok(orders);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(Order), 200)]
    [ProducesResponseType(404)]
    public async Task<ActionResult<Order>> GetOrder(Guid id, CancellationToken ct)
    {
        var order = await _orders.GetByIdAsync(id, ct);
        return order is null ? NotFound() : Ok(order);
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateOrderResponse), 201)]
    public async Task<ActionResult<CreateOrderResponse>> CreateOrder(
        [FromBody] CreateOrderDto dto,
        CancellationToken ct)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerId = dto.CustomerId,
            Status = "pending",
            TotalAmount = 0,
        };

        order.Items = dto.Items.Select(i => new OrderItem
        {
            Id = Guid.NewGuid(),
            ProductVariantId = i.ProductVariantId,
            Quantity = i.Quantity,
            UnitPrice = 0,
        }).ToList();

        await _orders.AddAsync(order, ct);
        await _uow.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, new CreateOrderResponse
        {
            OrderId = order.Id,
            TotalAmount = order.TotalAmount,
            Status = order.Status,
        });
    }

    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(Order), 200)]
    [ProducesResponseType(404)]
    public async Task<ActionResult<Order>> UpdateOrderStatus(
        Guid id,
        [FromBody] UpdateOrderStatusDto dto,
        CancellationToken ct)
    {
        var order = await _orders.GetByIdAsync(id, ct);
        if (order is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(dto.Status))
            order.Status = dto.Status;

        await _orders.UpdateAsync(order, ct);
        await _uow.SaveChangesAsync(ct);

        return Ok(order);
    }
}
