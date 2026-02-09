# ---------- build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# copy csproj files first
COPY ["TechNewsWorker/TechNewsWorker.csproj", "TechNewsWorker/"]
COPY ["TechNewsCore/TechNewsCore.csproj", "TechNewsCore/"]

RUN dotnet restore "TechNewsWorker/TechNewsWorker.csproj"

# copy everything
COPY . .

RUN dotnet publish "TechNewsWorker/TechNewsWorker.csproj" -c Release -o /app/publish --no-restore

# ---------- runtime stage ----------
FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TechNewsWorker.dll"]
