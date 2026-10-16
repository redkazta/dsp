using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using System;
using System.Threading.Tasks;

namespace WildForgeLabs.Infrastructure.Middleware;

public static class TenantMiddlewareExtensions
{
    public static IApplicationBuilder UseTenantResolution(this IApplicationBuilder app)
    {
        return app.UseMiddleware<TenantMiddleware>();
    }
}

public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(Func<WildForgeLabsDbFactory> dbFactory, Func<WildForgeLabsDbFactory> dbFactory2)
    {
        var tenantId = ResolveTenantFromRequest();
        if (tenantId == Guid.Empty)
        {
            await _next(context);
            return;
        }

        // Store tenant in context
        context.Items["TenantId"] = tenantId;

        await _next(context);
    }

    private Guid ResolveTenantFromRequest()
    {
        var host = context.Request.Host.Host;
        var subdomain = host.Split('.')[0];
        return subdomain switch
        {
            "tienda" => Guid.Parse("..."), // Resolve from DB
            _ => Guid.Empty
        };
    }
}