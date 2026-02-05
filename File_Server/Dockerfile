# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY ["file_server.csproj", "./"]
RUN dotnet restore "file_server.csproj"

# Copy everything else and build
COPY . .
RUN dotnet build "file_server.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "file_server.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Create directory for SQLite database
RUN mkdir -p /app/data

# Expose ports
EXPOSE 8080
EXPOSE 8081

# Copy published app
COPY --from=publish /app/publish .

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Run the application
ENTRYPOINT ["dotnet", "file_server.dll"]
