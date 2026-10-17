using WildForgeLabs.Core.DTOs;

namespace WildForgeLabs.Core.Interfaces;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IProductRepository
{
    Task<GetProductListResponse> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? search = null,
        Guid? categoryId = null,
        decimal? minPrice = null,
        decimal? maxPrice = null,
        CancellationToken cancellationToken = default);

    Task<GetProductByIdResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(WildForgeLabs.Core.Entities.Product product, CancellationToken cancellationToken = default);
    Task UpdateAsync(WildForgeLabs.Core.Entities.Product product, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public interface IOrderRepository
{
    Task<IEnumerable<WildForgeLabs.Core.Entities.Order>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<WildForgeLabs.Core.Entities.Order?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(WildForgeLabs.Core.Entities.Order order, CancellationToken cancellationToken = default);
    Task UpdateAsync(WildForgeLabs.Core.Entities.Order order, CancellationToken cancellationToken = default);
}

public interface IUserRepository
{
    Task<IEnumerable<WildForgeLabs.Core.Entities.Customer>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<WildForgeLabs.Core.Entities.Customer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(WildForgeLabs.Core.Entities.Customer customer, CancellationToken cancellationToken = default);
}

public interface IPaymentRepository
{
    Task<IEnumerable<WildForgeLabs.Core.Entities.Payment>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<WildForgeLabs.Core.Entities.Payment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(WildForgeLabs.Core.Entities.Payment payment, CancellationToken cancellationToken = default);
}

public interface ICustomerRepository
{
    Task<IEnumerable<WildForgeLabs.Core.Entities.Customer>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<WildForgeLabs.Core.Entities.Customer?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(WildForgeLabs.Core.Entities.Customer customer, CancellationToken cancellationToken = default);
}

public interface IPaymentService
{
    Task<CreatePaymentResponse> CreatePaymentAsync(
        CreatePaymentDto dto,
        CancellationToken cancellationToken = default);
}
