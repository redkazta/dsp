using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WildForgeLabs.Core.DTOs;
using WildForgeLabs.Core.Entities;
using WildForgeLabs.Core.Interfaces;

namespace WildForgeLabs.Api.Controllers;

[ApiController]
[Route("api/v1/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductRepository _products;
    private readonly IUnitOfWork _uow;

    public ProductsController(IProductRepository products, IUnitOfWork uow)
    {
        _products = products;
        _uow = uow;
    }

    [HttpGet]
    [ProducesResponseType(typeof(GetProductListResponse), 200)]
    public async Task<ActionResult<GetProductListResponse>> GetProducts(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] decimal? minPrice = null,
        [FromQuery] decimal? maxPrice = null,
        CancellationToken ct = default)
    {
        var result = await _products.GetPagedAsync(
            Math.Max(1, pageNumber),
            Math.Clamp(pageSize, 1, 100),
            search, categoryId, minPrice, maxPrice, ct);

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(GetProductByIdResponse), 200)]
    [ProducesResponseType(404)]
    public async Task<ActionResult<GetProductByIdResponse>> GetProduct(Guid id, CancellationToken ct)
    {
        var product = await _products.GetByIdAsync(id, ct);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpPost]
    [ProducesResponseType(typeof(ProductDto), 201)]
    public async Task<ActionResult<ProductDto>> CreateProduct(
        [FromBody] CreateProductDto dto,
        CancellationToken ct)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            BasePrice = dto.BasePrice,
            Sku = dto.SKU,
            IsActive = true,
            Variants = dto.Variants.Select(v => new ProductVariant
            {
                Id = Guid.NewGuid(),
                Name = v.Name,
                Price = v.Price,
                Stock = v.Stock,
            }).ToList(),
        };

        await _products.AddAsync(product, ct);
        await _uow.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Description = product.Description ?? string.Empty,
            BasePrice = product.BasePrice,
            SKU = product.Sku ?? string.Empty,
            IsActive = product.IsActive,
        });
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteProduct(Guid id, CancellationToken ct)
    {
        var product = await _products.GetByIdAsync(id, ct);
        if (product is null) return NotFound();

        await _products.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        return NoContent();
    }
}
