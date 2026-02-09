# ---------- build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj files first (for caching + restore)
COPY ["TechNewsApi/TechNewsApi.csproj", "TechNewsApi/"]
COPY ["TechNewsCore/TechNewsCore.csproj", "TechNewsCore/"]

# Restore
RUN dotnet restore "TechNewsApi/TechNewsApi.csproj"

# Copy the rest of the repo
COPY . .

# Publish
RUN dotnet publish "TechNewsApi/TechNewsApi.csproj" -c Release -o /app/publish --no-restore

# ---------- runtime stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TechNewsApi.dll"]
