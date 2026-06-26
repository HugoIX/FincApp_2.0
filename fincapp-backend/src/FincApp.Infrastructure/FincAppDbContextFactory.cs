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
            ?? "Host=db.ekamlzyjrtqdsfihvang.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=tFFShjEeJPYTuEv5;SSL Mode=Require;";
        optionsBuilder.UseNpgsql(connectionString);

        return new FincAppDbContext(optionsBuilder.Options, new DummyTenantProvider());
    }
}
