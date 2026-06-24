using System;

namespace FincApp.Core.Interfaces;

public interface ITenantProvider
{
    Guid? TenantId { get; }
}
