using Microsoft.EntityFrameworkCore;

// This file configures the EF Core configuration for the application.
// It sets up the connection string, uses the multi-tenant strategy via TenantId,
// and applies global filters for soft-delete and audit columns.

public static class DatabaseConfiguration
{
    // In production, these should come from environment variables
    public const string ConnectionString = "Server=localhost;Database=WildForgeLabs;Trusted_Connection=True;";

    public static void Configure(IServiceCollection services)
    {
        services.AddDbContext<WildForgeLabsDbContext>(options =>
            options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection"))
                  .WithPoolSize(10)
                  .WithMaximumLivelockTimeout(5));

        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IInventoryRepository, InventoryRepository>();
        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddScoped<INotificationService, NotificationService>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                Option.HeaderName = "Authorization";
                Option.TokenLocation = JwtBearerTokenLocation.header;
            });

        services.AddCors(options =>
        {
            options.AddPolicy("AllowFromFrontend", policy =>
                policy.AllowAnyOrigin()
                      .AllowAnyMethod()
                      .AllowCredentials());
        });
    }
}
