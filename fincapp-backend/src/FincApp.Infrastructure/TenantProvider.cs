using System;
using FincApp.Core.Interfaces;
using Microsoft.AspNetCore.Http;

namespace FincApp.Infrastructure;

public class TenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? TenantId
    {
        get
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null) return null;

            if (httpContext.Request.Headers.TryGetValue("X-Farm-Id", out var tenantHeaderValues))
            {
                var tenantHeader = tenantHeaderValues.ToString();
                if (Guid.TryParse(tenantHeader, out var tenantId))
                {
                    return tenantId;
                }
            }

            return null;
        }
    }
}
