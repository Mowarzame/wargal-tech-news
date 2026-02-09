# ---------- build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj first for better layer caching
COPY ["TechNewsApi/TechNewsApi.csproj", "TechNewsApi/"]

# Restore
RUN dotnet restore "TechNewsApi/TechNewsApi.csproj"

# Copy the rest of the repo
COPY . .

# Publish
RUN dotnet publish "TechNewsApi/TechNewsApi.csproj" -c Release -o /app/publish --no-restore

# ---------- runtime stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Render sets PORT; ASP.NET must listen on it
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "TechNewsApi.dll"]
