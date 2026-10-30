# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# CatanServer - ASP.NET Core 10 SignalR backend
#
#   docker build -t catan-server .
#   docker run -p 8080:8080 -e ALLOWED_ORIGINS=https://your-frontend.example.com catan-server
# ---------------------------------------------------------------------------

# ---- Build stage -----------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so the NuGet layer is cached between source-only changes.
COPY CatanServer.csproj nuget.config ./
RUN dotnet restore CatanServer.csproj

# The React app is built in its own image; keep it out of this one.
COPY . .
RUN rm -rf clientapp

RUN dotnet publish CatanServer.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# ---- Runtime stage ---------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Render/Railway inject PORT; default to 8080 for Azure Container Apps and local runs.
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_EnableDiagnostics=0
EXPOSE 8080

# Run as the non-root user shipped with the aspnet image.
USER $APP_UID

COPY --from=build /app/publish .

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:${ASPNETCORE_HTTP_PORTS:-8080}/health || exit 1

# Honour a platform-provided PORT (Render, Railway, Heroku-style) if present.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-${ASPNETCORE_HTTP_PORTS:-8080}} exec dotnet CatanServer.dll"]
