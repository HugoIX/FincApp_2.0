using System;
using FincApp.Core.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FincApp.Infrastructure;

public class FincAppDbContextFactory : IDesignTimeDbContextFactory<FincAppDbContext>
{
    private class DummyTenantProvider : ITenantProvider
    {
        public Guid? TenantId => null;
    }

    public FincAppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<FincAppDbContext>();
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__FincAppDb")
            ?? "Host=localhost;Port=5433;Database=fincapp_local;Username=postgres;Password=postgres;SSL Mode=Disable;";
        optionsBuilder.UseNpgsql(connectionString);

        return new FincAppDbContext(optionsBuilder.Options, new DummyTenantProvider());
    }
}
