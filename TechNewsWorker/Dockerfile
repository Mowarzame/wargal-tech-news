# =========================
# Build stage (.NET 10 SDK)
# =========================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj files first (better layer caching)
COPY TechNewsCore/TechNewsCore.csproj TechNewsCore/
COPY TechNewsWorker/TechNewsWorker.csproj TechNewsWorker/

# Restore
RUN dotnet restore "TechNewsWorker/TechNewsWorker.csproj"

# Copy everything else and publish
COPY . .
RUN dotnet publish "TechNewsWorker/TechNewsWorker.csproj" -c Release -o /app/publish --no-restore


# =========================
# Runtime stage (.NET 10 ASP.NET runtime)
# =========================
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Fix: libgssapi_krb5.so.2 missing (Kerberos / GSSAPI runtime lib)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*

# Copy published output
COPY --from=build /app/publish .

# Render usually injects PORT; worker doesn't need it, but harmless to keep clean.
ENV DOTNET_EnableDiagnostics=0

ENTRYPOINT ["dotnet", "TechNewsWorker.dll"]
