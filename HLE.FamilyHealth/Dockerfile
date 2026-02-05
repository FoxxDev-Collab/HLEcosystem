# HLE Template Dockerfile
# .NET 10 (LTS) ASP.NET Core MVC Application

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
# Run as non-root user
USER app

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["HLE.Template.csproj", "."]
RUN dotnet restore "HLE.Template.csproj"
COPY . .
RUN dotnet build "HLE.Template.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "HLE.Template.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HLE.Template.dll"]
