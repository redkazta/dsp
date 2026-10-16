namespace WildForgeLabs.Core.DTOs;

public class ProductDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal BasePrice { get; set; }
    public string SKU { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public ICollection<ProductVariantDto> Variants { get; set; } = new List<ProductVariantDto>();
}

public class ProductVariantDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
}

public class CreateProductDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal BasePrice { get; set; }
    public string SKU { get; set; } = string.Empty;
    public ICollection<CreateProductVariantDto> Variants { get; set; } = new List<CreateProductVariantDto>();
}

public class CreateProductVariantDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
}

public class UpdateProductDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? BasePrice { get; set; }
    public string? SKU { get; set; }
    public ICollection<UpdateProductVariantDto> Variants { get; set; } = new List<UpdateProductVariantDto>();
}

public class UpdateProductVariantDto
{
    public string? Name { get; set; }
    public decimal? Price { get; set; }
    public int? Stock { get; set; }
}

public class GetProductListResponse
{
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public ICollection<ProductDto> Items { get; set; } = new List<ProductDto>();
}

public class GetProductByIdResponse
{
    public ProductDto Product { get; set; } = null!;
    public ICollection<ProductVariantDto> Variants { get; set; } = new List<ProductVariantDto>();
    public ICollection<CategoryDto> Categories { get; set; } = new List<CategoryDto>();
    public ICollection<TagDto> Tags { get; set; } = new List<TagDto>();
}

public class CategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? ParentCategoryId { get; set; }
}

public class TagDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class CreateOrderDto
{
    public Guid CustomerId { get; set; }
    public ICollection<CreateOrderItemDto> Items { get; set; } = new List<CreateOrderItemDto>();
}

public class CreateOrderItemDto
{
    public Guid ProductVariantId { get; set; }
    public int Quantity { get; set; }
}

public class CreateOrderResponse
{
    public Guid OrderId { get; set; }
    public decimal TotalAmount { get; set; }
    public string? Status { get; set; }
}

public class UpdateOrderStatusDto
{
    public string? Status { get; set; }
}

public class CreatePaymentDto
{
    public Guid OrderId { get; set; }
    public string Provider { get; set; } = string.Empty; // Stripe, MercadoPago, Conekta
    public decimal Amount { get; set; }
}

public class CreatePaymentResponse
{
    public string? PaymentUrl { get; set; }
    public string? ProviderTransactionId { get; set; }
}