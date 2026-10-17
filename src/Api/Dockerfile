# ============================================
# WildForgeLabs API - Dockerfile para Render
# ============================================

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copiar csproj y restaurar (mejor cache)
COPY WildForgeLabs.Api.csproj ./
RUN dotnet restore

# Copiar el resto y publicar
COPY . ./
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Render inyecta el puerto en $PORT
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "WildForgeLabs.Api.dll"]
