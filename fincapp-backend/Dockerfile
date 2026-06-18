FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

COPY src/FincApp.Core/FincApp.Core.csproj src/FincApp.Core/
COPY src/FincApp.Infrastructure/FincApp.Infrastructure.csproj src/FincApp.Infrastructure/
COPY src/FincApp.API/FincApp.API.csproj src/FincApp.API/
COPY src/FincApp.slnx src/
RUN dotnet restore src/FincApp.API/FincApp.API.csproj

COPY src/ src/
WORKDIR /app/src/FincApp.API
RUN dotnet publish -c Release -o /app/out

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/out .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "FincApp.API.dll"]
