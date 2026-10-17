# ============================================
# WildForgeLabs API - Dockerfile para Render
# Build context: raíz del repo (/)
# ============================================

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copiar csproj de los 3 proyectos y restaurar
COPY src/Core/WildForgeLabs.Core.csproj src/Core/
COPY src/Infrastructure/WildForgeLabs.Infrastructure.csproj src/Infrastructure/
COPY src/Api/WildForgeLabs.Api.csproj src/Api/
RUN dotnet restore src/Api/WildForgeLabs.Api.csproj

# Copiar el resto del código
COPY src/ src/

RUN dotnet publish src/Api/WildForgeLabs.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "WildForgeLabs.Api.dll"]
