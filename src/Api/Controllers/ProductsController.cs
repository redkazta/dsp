using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WildForgeLabs.Core.DTOs;
using WildForgeLabs.Core.Interfaces;

namespace WildForgeLabs.Api.Controllers;

[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductRepository _productRepository;
    private readonly IUnitOfWork _unitOfWork;

    public ProductsController(IProductRepository productRepository, IUnitOfWork unitOfWork)
    {
        _productRepository = productRepository;
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// Lista paginada de productos
    /// </summary>
    /// <param name="pageNumber">Número de página (default 1)</param>
    /// <param name="pageSize">Tamaño de página (default 20)</param>
    /// <param name="search">Término de búsqueda</param>
    /// <param name="categoryId">Filtrar por categoría</param>
    /// <param name="minPrice">Precio mínimo</param>
    /// <param name="maxPrice">Precio máximo</param>
    /// <returns>Lista paginada de productos</returns>
    [HttpGet]
    [ProducesResponseType(typeof(GetProductListResponse), 200)]
    public async Task<ActionResult<GetProductListResponse>> GetProducts(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] decimal? minPrice = null,
        [FromQuery] decimal? maxPrice = null)
    {
        var products = await _productRepository.GetPagedAsync(
            pageNumber, pageSize, search, categoryId, minPrice, maxPrice);

        return Ok(products);
    }

    /// <summary>
    /// Obtiene un producto por ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(GetProductByIdResponse), 200)]
    [ProducesResponseType(404)]
    public async Task<ActionResult<GetProductByIdResponse>> GetProduct(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return NotFound();

        return Ok(product);
    }

    /// <summary>
    /// Crea un nuevo producto
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ProductDto), 201)]
    [ProducesResponseType(400)]
    public async Task<ActionResult<ProductDto>> CreateProduct([FromBody] CreateProductDto dto)
    {
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            BasePrice = dto.BasePrice,
            SKU = dto.SKU,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Crear variantes
        foreach (var variantDto in dto.Variants)
        {
            product.Variants.Add(new ProductVariant
            {
                Id = Guid.NewGuid(),
                Name = variantDto.Name,
                Price = variantDto.Price,
                Stock = variantDto.Stock,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _productRepository.AddAsync(product);
        await _unitOfWork.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
    }

    /// <summary>
    /// Actualiza un producto existente
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ProductDto), 200)]
    [ProducesResponseType(404)]
    public async Task<ActionResult<ProductDto>> UpdateProduct(Guid id, [FromBody] UpdateProductDto dto)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return NotFound();

        product.Name = dto.Name ?? product.Name;
        product.Description = dto.Description ?? product.Description;
        product.BasePrice = dto.BasePrice ?? product.BasePrice;
        product.SKU = dto.SKU ?? product.SKU;
        product.UpdatedAt = DateTime.UtcNow;

        await _productRepository.UpdateAsync(product);
        await _unitOfWork.SaveChangesAsync();

        return Ok(product);
    }

    /// <summary>
    /// Elimina un producto (soft delete)
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteProduct(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product == null)
            return NotFound();

        await _productRepository.DeleteAsync(id);
        await _unitOfWork.SaveChangesAsync();

        return NoContent();
    }
}