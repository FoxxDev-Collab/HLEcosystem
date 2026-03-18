#!/bin/bash
# rebuild.sh — Clean rebuild for HLEcosystem containers
# Usage: ./rebuild.sh <service-name|all>
# Example: ./rebuild.sh hle-family-manager
#          ./rebuild.sh all

set -e

SERVICES=(
  hle-family-manager
  hle-familyhub
  hle-family-finance
  hle-family-health
  hle-family-home-care
  hle-file-server
  hle-grocery-planner
)

CONTAINER_MAP=(
  "hle-family-manager:foxxlab-family-manager"
  "hle-familyhub:foxxlab-familyhub"
  "hle-family-finance:foxxlab-family-finance"
  "hle-family-health:foxxlab-family-health"
  "hle-family-home-care:foxxlab-family-home-care"
  "hle-file-server:foxxlab-file-server"
  "hle-grocery-planner:foxxlab-grocery-planner"
)

rebuild_service() {
  local service="$1"
  local container=""
  local image="hlecosystem_${service}:latest"

  # Find container name
  for entry in "${CONTAINER_MAP[@]}"; do
    local svc="${entry%%:*}"
    local ctr="${entry##*:}"
    if [ "$svc" = "$service" ]; then
      container="$ctr"
      break
    fi
  done

  if [ -z "$container" ]; then
    echo "Unknown service: $service"
    return 1
  fi

  echo "=== Rebuilding $service ==="

  # Stop and remove container
  echo "  Stopping $container..."
  podman stop "$container" 2>/dev/null || true
  podman rm "$container" 2>/dev/null || true

  # Remove old image
  echo "  Removing old image..."
  podman rmi "localhost/$image" 2>/dev/null || true

  # Build with no cache
  echo "  Building (no cache)..."
  podman-compose build --no-cache "$service"

  # Start
  echo "  Starting..."
  podman-compose up -d "$service"

  # Wait and health check
  echo "  Waiting for health check..."
  sleep 5
  local port=""
  case "$service" in
    hle-family-manager)  port=8080 ;;
    hle-familyhub)       port=8081 ;;
    hle-family-finance)  port=8082 ;;
    hle-family-health)   port=8083 ;;
    hle-family-home-care) port=8084 ;;
    hle-file-server)     port=8085 ;;
    hle-grocery-planner) port=8086 ;;
  esac

  if [ -n "$port" ]; then
    local health
    health=$(curl -s "http://localhost:$port/api/health" 2>/dev/null || echo '{"status":"unreachable"}')
    echo "  Health: $health"
  fi

  echo "  Done: $service"
  echo ""
}

if [ -z "$1" ]; then
  echo "Usage: ./rebuild.sh <service-name|all>"
  echo ""
  echo "Services:"
  for s in "${SERVICES[@]}"; do echo "  $s"; done
  exit 1
fi

cd /home/foxx-dev/HLEcosystem

if [ "$1" = "all" ]; then
  # Make sure postgres is running first
  podman-compose up -d postgres
  sleep 3

  for service in "${SERVICES[@]}"; do
    rebuild_service "$service"
  done

  echo "=== All services rebuilt ==="
  podman-compose ps
else
  rebuild_service "$1"
fi
