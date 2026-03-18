#!/bin/bash
# hle — HLEcosystem container management
# Usage: ./hle <command> [service|all]

set -euo pipefail

PROJECT_DIR="/home/foxx-dev/HLEcosystem"
cd "$PROJECT_DIR"

# ── Parallelism ─────────────────────────────────────────────────
# Max concurrent builds — tuned for 2 CPU / 13 GB RAM
MAX_PARALLEL=2

# ── Service registry ──────────────────────────────────────────────
declare -A PORTS=(
  [hle-family-manager]=8080
  [hle-familyhub]=8081
  [hle-family-finance]=8082
  [hle-family-health]=8083
  [hle-family-home-care]=8084
  [hle-file-server]=8085
  [hle-grocery-planner]=8086
)

declare -A CONTAINERS=(
  [hle-family-manager]=foxxlab-family-manager
  [hle-familyhub]=foxxlab-familyhub
  [hle-family-finance]=foxxlab-family-finance
  [hle-family-health]=foxxlab-family-health
  [hle-family-home-care]=foxxlab-family-home-care
  [hle-file-server]=foxxlab-file-server
  [hle-grocery-planner]=foxxlab-grocery-planner
)

SERVICES=(
  hle-family-manager
  hle-familyhub
  hle-family-finance
  hle-family-health
  hle-family-home-care
  hle-file-server
  hle-grocery-planner
)

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────
info()    { echo -e "${BLUE}▸${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}!${NC} $*"; }
error()   { echo -e "${RED}✗${NC} $*"; }
header()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}"; }

validate_service() {
  local svc="$1"
  if [[ -z "${PORTS[$svc]+x}" ]]; then
    error "Unknown service: $svc"
    echo "Valid services:"
    for s in "${SERVICES[@]}"; do echo "  $s"; done
    exit 1
  fi
}

resolve_targets() {
  local target="${1:-}"
  if [[ "$target" == "all" || -z "$target" ]]; then
    echo "${SERVICES[@]}"
  else
    validate_service "$target"
    echo "$target"
  fi
}

health_check() {
  local svc="$1"
  local port="${PORTS[$svc]}"
  local attempts=0
  local max_attempts=12

  while (( attempts < max_attempts )); do
    if curl -sf "http://localhost:$port/api/health" > /dev/null 2>&1; then
      success "$svc healthy on :$port"
      return 0
    fi
    (( attempts++ ))
    sleep 5
  done

  warn "$svc not responding on :$port after 60s"
  return 1
}

# ── Commands ──────────────────────────────────────────────────────

rebuild_one() {
  local svc="$1"
  local no_cache="${2:-}"
  local logfile="/tmp/hle-build-${svc}.log"
  local ctr="${CONTAINERS[$svc]}"

  {
    echo "=== Rebuilding $svc ==="

    # Stop and remove container
    echo "  Stopping $ctr..."
    podman stop "$ctr" 2>/dev/null || true
    podman rm "$ctr" 2>/dev/null || true

    # Remove old image
    echo "  Removing old image..."
    podman rmi "localhost/hlecosystem_${svc}:latest" 2>/dev/null || true

    # Build — use --jobs 0 to parallelize multi-stage Containerfile stages
    if [[ "$no_cache" == "--no-cache" ]]; then
      echo "  Building (no cache, parallel stages)..."
      podman-compose build --build-arg BUILDAH_JOBS=0 --no-cache "$svc"
    else
      echo "  Building (parallel stages)..."
      podman-compose build "$svc"
    fi

    echo "  DONE: $svc"
  } > "$logfile" 2>&1

  return $?
}

cmd_rebuild() {
  local target="${1:-}"
  local no_cache="${2:-}"
  local targets
  read -ra targets <<< "$(resolve_targets "$target")"

  # Ensure postgres is up
  info "Ensuring postgres is running..."
  podman-compose up -d postgres
  sleep 3

  local count=${#targets[@]}

  # Single service — build sequentially, no parallelism needed
  if (( count == 1 )); then
    local svc="${targets[0]}"
    header "Rebuilding $svc"
    local ctr="${CONTAINERS[$svc]}"

    info "Stopping $ctr..."
    podman stop "$ctr" 2>/dev/null || true
    podman rm "$ctr" 2>/dev/null || true

    info "Removing old image..."
    podman rmi "localhost/hlecosystem_${svc}:latest" 2>/dev/null || true

    if [[ "$no_cache" == "--no-cache" ]]; then
      info "Building (no cache)..."
      podman-compose build --no-cache "$svc"
    else
      info "Building..."
      podman-compose build "$svc"
    fi

    info "Starting..."
    podman-compose up -d "$svc"

    info "Waiting for health check..."
    health_check "$svc" || true
    return
  fi

  # Multiple services — parallel build phase
  header "Parallel rebuild: ${count} services (max ${MAX_PARALLEL} concurrent)"

  local pids=()
  local svc_for_pid=()
  local running=0
  local failed=()

  for svc in "${targets[@]}"; do
    # Throttle: wait for a slot if at max
    while (( running >= MAX_PARALLEL )); do
      # Wait for any child to finish
      for i in "${!pids[@]}"; do
        if ! kill -0 "${pids[$i]}" 2>/dev/null; then
          wait "${pids[$i]}" || failed+=("${svc_for_pid[$i]}")
          unset 'pids[i]' 'svc_for_pid[i]'
          (( running-- ))
        fi
      done
      # Re-index arrays
      pids=("${pids[@]}")
      svc_for_pid=("${svc_for_pid[@]}")
      sleep 1
    done

    info "Starting build: $svc (log: /tmp/hle-build-${svc}.log)"
    rebuild_one "$svc" "$no_cache" &
    pids+=($!)
    svc_for_pid+=("$svc")
    (( running++ ))
  done

  # Wait for remaining builds
  info "Waiting for all builds to finish..."
  for i in "${!pids[@]}"; do
    wait "${pids[$i]}" || failed+=("${svc_for_pid[$i]}")
  done

  # Report build results
  echo ""
  if (( ${#failed[@]} > 0 )); then
    error "Build failed for: ${failed[*]}"
    for svc in "${failed[@]}"; do
      warn "Log: /tmp/hle-build-${svc}.log"
    done
  fi

  # Print build logs in order
  for svc in "${targets[@]}"; do
    local logfile="/tmp/hle-build-${svc}.log"
    if [[ -f "$logfile" ]]; then
      local last_line
      last_line=$(tail -1 "$logfile")
      if [[ "$last_line" == *"DONE:"* ]]; then
        success "$svc built"
      else
        error "$svc build failed — see /tmp/hle-build-${svc}.log"
      fi
    fi
  done

  # Start all services at once
  header "Starting services"
  podman-compose up -d "${targets[@]}"

  # Health checks
  header "Health checks"
  sleep 5
  for svc in "${targets[@]}"; do
    health_check "$svc" || true
  done

  header "All services rebuilt"
  cmd_status

  # Cleanup log files on success
  if (( ${#failed[@]} == 0 )); then
    rm -f /tmp/hle-build-*.log
  fi
}

cmd_up() {
  local target="${1:-}"
  if [[ "$target" == "all" || -z "$target" ]]; then
    header "Starting all services"
    podman-compose up -d
  else
    validate_service "$target"
    header "Starting $target"
    podman-compose up -d postgres "$target"
  fi
}

cmd_down() {
  local target="${1:-}"
  if [[ "$target" == "all" || -z "$target" ]]; then
    header "Stopping all services"
    podman-compose down
  else
    validate_service "$target"
    header "Stopping $target"
    podman stop "${CONTAINERS[$target]}" 2>/dev/null || true
    podman rm "${CONTAINERS[$target]}" 2>/dev/null || true
  fi
}

cmd_restart() {
  local target="${1:-}"
  local targets
  read -ra targets <<< "$(resolve_targets "$target")"

  for svc in "${targets[@]}"; do
    header "Restarting $svc"
    podman restart "${CONTAINERS[$svc]}"
    health_check "$svc" || true
  done
}

cmd_status() {
  header "Container Status"
  printf "  ${BOLD}%-28s %-12s %-20s${NC}\n" "SERVICE" "STATE" "PORTS"
  echo "  ────────────────────────────────────────────────────────────"

  # Postgres
  local pg_state
  pg_state=$(podman inspect --format '{{.State.Status}}' foxxlab-postgres 2>/dev/null || echo "not found")
  local pg_health
  pg_health=$(podman exec foxxlab-postgres pg_isready 2>/dev/null && echo "ready" || echo "down")
  if [[ "$pg_state" == "running" ]]; then
    success "$(printf '%-28s %-12s %-20s' 'postgres' "$pg_state" '127.0.0.1:5432')"
  else
    error "$(printf '%-28s %-12s %-20s' 'postgres' "$pg_state" '-')"
  fi

  # App services
  for svc in "${SERVICES[@]}"; do
    local port="${PORTS[$svc]}"
    local ctr="${CONTAINERS[$svc]}"
    local state
    state=$(podman inspect --format '{{.State.Status}}' "$ctr" 2>/dev/null || echo "not found")

    if [[ "$state" == "running" ]]; then
      success "$(printf '%-28s %-12s %-20s' "$svc" "$state" "0.0.0.0:$port")"
    else
      error "$(printf '%-28s %-12s %-20s' "$svc" "$state" '-')"
    fi
  done

  echo ""
  header "Health Checks"
  for svc in "${SERVICES[@]}"; do
    local port="${PORTS[$svc]}"
    local response
    response=$(curl -sf "http://localhost:$port/api/health" 2>/dev/null || echo "unreachable")
    if [[ "$response" != "unreachable" ]]; then
      success "$svc :$port — $response"
    else
      error "$svc :$port — unreachable"
    fi
  done
}

cmd_logs() {
  local target="${1:-}"
  local follow="${2:-}"
  if [[ -z "$target" ]]; then
    error "Usage: hle logs <service> [--follow]"
    exit 1
  fi

  if [[ "$target" == "postgres" ]]; then
    if [[ "$follow" == "--follow" || "$follow" == "-f" ]]; then
      podman logs -f foxxlab-postgres
    else
      podman logs --tail 100 foxxlab-postgres
    fi
    return
  fi

  validate_service "$target"
  if [[ "$follow" == "--follow" || "$follow" == "-f" ]]; then
    podman logs -f "${CONTAINERS[$target]}"
  else
    podman logs --tail 100 "${CONTAINERS[$target]}"
  fi
}

cmd_shell() {
  local target="${1:-}"
  if [[ -z "$target" ]]; then
    error "Usage: hle shell <service>"
    exit 1
  fi

  if [[ "$target" == "postgres" ]]; then
    podman exec -it foxxlab-postgres psql -U "${POSTGRES_USER:-foxxlab}" -d foxxlab
    return
  fi

  validate_service "$target"
  podman exec -it "${CONTAINERS[$target]}" /bin/sh
}

cmd_clean() {
  header "Cleaning up"
  info "Removing stopped containers..."
  podman container prune -f
  info "Removing dangling images..."
  podman image prune -f
  info "Removing build cache..."
  podman builder prune -f 2>/dev/null || true
  success "Cleanup complete"
}

cmd_nuke() {
  header "Full teardown"
  warn "This will stop all containers, remove images, and delete volumes."
  read -rp "Are you sure? (y/N) " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    info "Aborted."
    exit 0
  fi

  podman-compose down -v 2>/dev/null || true
  for svc in "${SERVICES[@]}"; do
    podman rmi "localhost/hlecosystem_${svc}:latest" 2>/dev/null || true
  done
  podman image prune -f
  success "Everything torn down. Run 'hle rebuild all' to start fresh."
}

# ── Usage ─────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}hle${NC} — HLEcosystem container management

${BOLD}USAGE${NC}
  hle <command> [service|all] [flags]

${BOLD}COMMANDS${NC}
  ${GREEN}rebuild${NC}  [service|all] [--no-cache]   Build & restart (parallel when "all")
  ${GREEN}up${NC}       [service|all]                 Start services
  ${GREEN}down${NC}     [service|all]                 Stop services
  ${GREEN}restart${NC}  [service|all]                 Restart without rebuilding
  ${GREEN}status${NC}                                 Show status & health checks
  ${GREEN}logs${NC}     <service> [--follow]          View container logs
  ${GREEN}shell${NC}    <service|postgres>            Open shell in container
  ${GREEN}clean${NC}                                  Remove stopped containers & dangling images
  ${GREEN}nuke${NC}                                   Full teardown (containers, images, volumes)

${BOLD}SERVICES${NC}
  hle-family-manager    :8080
  hle-familyhub         :8081
  hle-family-finance    :8082
  hle-family-health     :8083
  hle-family-home-care  :8084
  hle-file-server       :8085
  hle-grocery-planner   :8086
  postgres              (logs/shell only)

${BOLD}EXAMPLES${NC}
  hle rebuild hle-familyhub           Rebuild single service (cached)
  hle rebuild hle-familyhub --no-cache Rebuild with no cache
  hle rebuild all                     Rebuild everything
  hle status                          Check all health endpoints
  hle logs hle-family-finance -f      Tail logs
  hle shell postgres                  Open psql session
EOF
}

# ── Main ──────────────────────────────────────────────────────────
case "${1:-}" in
  rebuild)  cmd_rebuild "${2:-}" "${3:-}" ;;
  up)       cmd_up "${2:-}" ;;
  down)     cmd_down "${2:-}" ;;
  restart)  cmd_restart "${2:-}" ;;
  status)   cmd_status ;;
  logs)     cmd_logs "${2:-}" "${3:-}" ;;
  shell)    cmd_shell "${2:-}" ;;
  clean)    cmd_clean ;;
  nuke)     cmd_nuke ;;
  *)        usage ;;
esac
