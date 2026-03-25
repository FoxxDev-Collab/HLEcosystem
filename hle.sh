#!/bin/bash
# hle — HLEcosystem container management
# Usage: ./hle <command> [service|all]

set -euo pipefail

PROJECT_DIR="/home/foxx-dev/HLEcosystem"
cd "$PROJECT_DIR"

# ── Parallelism ─────────────────────────────────────────────────
# Max concurrent builds — tuned for 8 vCPU / 20 GB RAM
MAX_PARALLEL=3

# ── Service registry ──────────────────────────────────────────────
declare -A PORTS=(
  [hle-family-manager]=8080
  [hle-familyhub]=8081
  [hle-family-finance]=8082
  [hle-family-health]=8083
  [hle-family-home-care]=8084
  [hle-file-server]=8085
  [hle-meal-prep]=8086
  [hle-family-wiki]=8087
  [hle-claude-api]=8088
)

declare -A CONTAINERS=(
  [hle-family-manager]=foxxlab-family-manager
  [hle-familyhub]=foxxlab-familyhub
  [hle-family-finance]=foxxlab-family-finance
  [hle-family-health]=foxxlab-family-health
  [hle-family-home-care]=foxxlab-family-home-care
  [hle-file-server]=foxxlab-file-server
  [hle-meal-prep]=foxxlab-meal-prep
  [hle-family-wiki]=foxxlab-family-wiki
  [hle-claude-api]=foxxlab-claude-api
)

SERVICES=(
  hle-family-manager
  hle-familyhub
  hle-family-finance
  hle-family-health
  hle-family-home-care
  hle-file-server
  hle-meal-prep
  hle-family-wiki
  hle-claude-api
)

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────
info()    { echo -e "${BLUE}▸${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}!${NC} $*"; }
error()   { echo -e "${RED}✗${NC} $*"; }
header()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}"; }

timestamp() { date +"%H:%M:%S"; }

elapsed() {
  local start="$1"
  local now
  now=$(date +%s)
  local diff=$(( now - start ))
  printf "%dm%02ds" $(( diff / 60 )) $(( diff % 60 ))
}

validate_service() {
  local svc="$1"
  if [[ -z "${PORTS[$svc]+x}" ]]; then
    error "Unknown service: $svc"
    echo "Valid services:"
    for s in "${SERVICES[@]}"; do echo "  $s  :${PORTS[$s]}"; done
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

# ── Build tracking ────────────────────────────────────────────────
# Track build status per service: pending, building, done, failed
declare -A BUILD_STATUS
declare -A BUILD_START

print_build_dashboard() {
  local targets=("$@")
  local total=${#targets[@]}
  local done=0
  local fail=0
  local building=0

  for svc in "${targets[@]}"; do
    case "${BUILD_STATUS[$svc]:-pending}" in
      done)     (( done++ )) ;;
      failed)   (( fail++ )); (( done++ )) ;;
      building) (( building++ )) ;;
    esac
  done

  echo ""
  printf "  ${BOLD}%-28s %-12s %-12s${NC}\n" "SERVICE" "STATUS" "TIME"
  echo "  ──────────────────────────────────────────────────────"

  for svc in "${targets[@]}"; do
    local status="${BUILD_STATUS[$svc]:-pending}"
    local time_str="-"
    if [[ -n "${BUILD_START[$svc]:-}" ]]; then
      time_str=$(elapsed "${BUILD_START[$svc]}")
    fi

    case "$status" in
      pending)  printf "  ${DIM}%-28s %-12s %-12s${NC}\n" "$svc" "pending" "-" ;;
      building) printf "  ${YELLOW}%-28s %-12s %-12s${NC}\n" "$svc" "building" "$time_str" ;;
      done)     printf "  ${GREEN}%-28s %-12s %-12s${NC}\n" "$svc" "done" "$time_str" ;;
      failed)   printf "  ${RED}%-28s %-12s %-12s${NC}\n" "$svc" "FAILED" "$time_str" ;;
    esac
  done

  echo ""
  echo -e "  Progress: ${BOLD}${done}/${total}${NC} complete, ${building} building, ${fail} failed"
}

# ── Commands ──────────────────────────────────────────────────────

rebuild_one() {
  local svc="$1"
  local no_cache="${2:-}"
  local logfile="/tmp/hle-build-${svc}.log"
  local ctr="${CONTAINERS[$svc]}"

  {
    echo "[$(timestamp)] === Rebuilding $svc ==="

    echo "[$(timestamp)] Stopping $ctr..."
    podman stop "$ctr" 2>/dev/null || true
    podman rm "$ctr" 2>/dev/null || true

    echo "[$(timestamp)] Removing old image..."
    podman rmi "localhost/hlecosystem_${svc}:latest" 2>/dev/null || true

    echo "[$(timestamp)] Building..."
    if [[ "$no_cache" == "--no-cache" ]]; then
      podman-compose build --no-cache "$svc"
    else
      podman-compose build "$svc"
    fi

    echo "[$(timestamp)] DONE: $svc"
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
  local pg_status
  pg_status=$(podman inspect --format '{{.State.Status}}' foxxlab-postgres 2>/dev/null || echo "missing")
  if [[ "$pg_status" == "running" ]]; then
    success "postgres already running"
  elif [[ "$pg_status" == "exited" || "$pg_status" == "stopped" || "$pg_status" == "created" ]]; then
    podman start foxxlab-postgres
    sleep 3
  else
    podman-compose up -d postgres
    sleep 3
  fi

  local count=${#targets[@]}
  local overall_start
  overall_start=$(date +%s)

  # Single service — inline build with live output
  if (( count == 1 )); then
    local svc="${targets[0]}"
    header "Rebuilding $svc"
    local ctr="${CONTAINERS[$svc]}"
    local svc_start
    svc_start=$(date +%s)

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

    success "$svc built in $(elapsed "$svc_start")"

    info "Starting..."
    podman-compose up -d "$svc"

    info "Waiting for health check..."
    health_check "$svc" || true
    return
  fi

  # Multiple services — sequential build with dashboard tracking
  header "Rebuilding ${count} services (max ${MAX_PARALLEL} concurrent)"
  echo -e "  ${DIM}Services: ${targets[*]}${NC}"

  # Initialize status
  for svc in "${targets[@]}"; do
    BUILD_STATUS[$svc]="pending"
    BUILD_START[$svc]=""
  done

  # Show initial dashboard
  print_build_dashboard "${targets[@]}"

  local -a pids=()
  local -a svc_for_pid=()
  local running=0
  local -a failed=()
  local -a succeeded=()

  # Collect finished background jobs — called in throttle loop and final wait
  collect_finished() {
    local -a new_pids=()
    local -a new_svcs=()
    for i in "${!pids[@]}"; do
      if kill -0 "${pids[$i]}" 2>/dev/null; then
        new_pids+=("${pids[$i]}")
        new_svcs+=("${svc_for_pid[$i]}")
      else
        local fsvc="${svc_for_pid[$i]}"
        local rc=0
        wait "${pids[$i]}" || rc=$?
        if (( rc == 0 )); then
          BUILD_STATUS[$fsvc]="done"
          succeeded+=("$fsvc")
          success "$fsvc built in $(elapsed "${BUILD_START[$fsvc]}")"
        else
          BUILD_STATUS[$fsvc]="failed"
          failed+=("$fsvc")
          error "$fsvc FAILED after $(elapsed "${BUILD_START[$fsvc]}") — see /tmp/hle-build-${fsvc}.log"
        fi
        running=$(( running - 1 ))
      fi
    done
    pids=("${new_pids[@]+"${new_pids[@]}"}")
    svc_for_pid=("${new_svcs[@]+"${new_svcs[@]}"}")
  }

  for svc in "${targets[@]}"; do
    # Throttle: wait for a slot
    while (( running >= MAX_PARALLEL )); do
      collect_finished
      if (( running >= MAX_PARALLEL )); then
        sleep 2
      fi
    done

    # Start build
    BUILD_STATUS[$svc]="building"
    BUILD_START[$svc]=$(date +%s)
    info "[$(timestamp)] Building $svc..."
    rebuild_one "$svc" "$no_cache" &
    pids+=($!)
    svc_for_pid+=("$svc")
    running=$(( running + 1 ))
  done

  # Wait for remaining builds
  info "Waiting for remaining builds..."
  while (( running > 0 )); do
    collect_finished
    if (( running > 0 )); then
      sleep 2
    fi
  done

  # Final dashboard
  header "Build Summary"
  print_build_dashboard "${targets[@]}"
  echo -e "  Total time: ${BOLD}$(elapsed "$overall_start")${NC}"

  if (( ${#failed[@]} > 0 )); then
    echo ""
    error "Failed services:"
    for svc in "${failed[@]}"; do
      echo -e "    ${RED}$svc${NC} — /tmp/hle-build-${svc}.log"
      echo -e "    ${DIM}$(tail -5 "/tmp/hle-build-${svc}.log" 2>/dev/null | head -3)${NC}"
    done
  fi

  # Start successful services
  if (( ${#succeeded[@]} > 0 )); then
    header "Starting ${#succeeded[@]} services"
    podman-compose up -d "${succeeded[@]}"

    header "Health checks"
    sleep 5
    local healthy=0
    local unhealthy=0
    for svc in "${succeeded[@]}"; do
      if health_check "$svc"; then
        (( healthy++ ))
      else
        (( unhealthy++ ))
      fi
    done

    echo ""
    echo -e "  ${GREEN}${healthy} healthy${NC}"
    if (( unhealthy > 0 )); then
      echo -e "  ${RED}${unhealthy} unhealthy${NC}"
    fi
  fi

  header "Done"
  echo -e "  ${GREEN}${#succeeded[@]}${NC} built, ${RED}${#failed[@]}${NC} failed out of ${count} services"

  # Cleanup logs on full success
  if (( ${#failed[@]} == 0 )); then
    rm -f /tmp/hle-build-*.log
  fi
}

cmd_up() {
  local target="${1:-}"
  if [[ "$target" == "all" || -z "$target" ]]; then
    header "Starting all services"
    podman-compose up -d
    sleep 5
    header "Health checks"
    for svc in "${SERVICES[@]}"; do
      health_check "$svc" || true
    done
  else
    validate_service "$target"
    header "Starting $target"
    podman-compose up -d postgres "$target"
    sleep 3
    health_check "$target" || true
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
  printf "  ${BOLD}%-28s %-12s %-10s %-12s${NC}\n" "SERVICE" "STATE" "PORT" "HEALTH"
  echo "  ──────────────────────────────────────────────────────────────"

  # Postgres
  local pg_state
  pg_state=$(podman inspect --format '{{.State.Status}}' foxxlab-postgres 2>/dev/null || echo "not found")
  local pg_health="—"
  if [[ "$pg_state" == "running" ]]; then
    pg_health=$(podman exec foxxlab-postgres pg_isready -q 2>/dev/null && echo "ready" || echo "down")
  fi
  if [[ "$pg_state" == "running" ]]; then
    printf "  ${GREEN}✓ %-27s %-12s %-10s %-12s${NC}\n" "postgres" "$pg_state" "5432" "$pg_health"
  else
    printf "  ${RED}✗ %-27s %-12s %-10s %-12s${NC}\n" "postgres" "$pg_state" "-" "$pg_health"
  fi

  # App services
  for svc in "${SERVICES[@]}"; do
    local port="${PORTS[$svc]}"
    local ctr="${CONTAINERS[$svc]}"
    local state
    state=$(podman inspect --format '{{.State.Status}}' "$ctr" 2>/dev/null || echo "not found")

    local health="—"
    if [[ "$state" == "running" ]]; then
      local resp
      resp=$(curl -sf --max-time 3 "http://localhost:$port/api/health" 2>/dev/null || echo "")
      if [[ -n "$resp" ]]; then
        health="healthy"
      else
        health="unreachable"
      fi
    fi

    if [[ "$state" == "running" && "$health" == "healthy" ]]; then
      printf "  ${GREEN}✓ %-27s %-12s %-10s %-12s${NC}\n" "$svc" "$state" ":$port" "$health"
    elif [[ "$state" == "running" ]]; then
      printf "  ${YELLOW}! %-27s %-12s %-10s %-12s${NC}\n" "$svc" "$state" ":$port" "$health"
    else
      printf "  ${RED}✗ %-27s %-12s %-10s %-12s${NC}\n" "$svc" "$state" "-" "$health"
    fi
  done

  echo ""
  local total=${#SERVICES[@]}
  local running=0
  for svc in "${SERVICES[@]}"; do
    local ctr="${CONTAINERS[$svc]}"
    local state
    state=$(podman inspect --format '{{.State.Status}}' "$ctr" 2>/dev/null || echo "")
    [[ "$state" == "running" ]] && (( running++ ))
  done
  echo -e "  ${BOLD}${running}/${total}${NC} app services running"
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

# ── Backup / Restore ─────────────────────────────────────────────
BACKUP_DIR="${PROJECT_DIR}/backups"

# Upload volume → container name mapping
declare -A UPLOAD_VOLUMES=(
  [family-finance-uploads]=foxxlab-family-finance
  [home-care-uploads]=foxxlab-family-home-care
  [file-server-uploads]=foxxlab-file-server
)

cmd_backup() {
  local tag
  tag=$(date +"%Y%m%d_%H%M%S")
  local dest="${BACKUP_DIR}/${tag}"
  mkdir -p "$dest"

  header "Full Backup → ${dest}"

  # ── 1. Database dump (all schemas, single file) ──
  info "Dumping PostgreSQL database (all schemas)..."
  local pg_state
  pg_state=$(podman inspect --format '{{.State.Status}}' foxxlab-postgres 2>/dev/null || echo "missing")
  if [[ "$pg_state" != "running" ]]; then
    error "PostgreSQL is not running. Start it first: hle up all"
    exit 1
  fi

  local db_file="${dest}/foxxlab.sql.gz"
  podman exec foxxlab-postgres pg_dump \
    -U "${POSTGRES_USER:-foxxlab_admin}" \
    -d foxxlab \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --create \
    | gzip > "$db_file"

  local db_size
  db_size=$(du -h "$db_file" | cut -f1)
  success "Database dump: ${db_file} (${db_size})"

  # ── 2. Upload volumes (tar each volume from its container) ──
  local vol_count=0
  for vol in "${!UPLOAD_VOLUMES[@]}"; do
    local ctr="${UPLOAD_VOLUMES[$vol]}"
    local ctr_state
    ctr_state=$(podman inspect --format '{{.State.Status}}' "$ctr" 2>/dev/null || echo "missing")

    if [[ "$ctr_state" != "running" ]]; then
      warn "Skipping ${vol} — container ${ctr} not running"
      continue
    fi

    info "Backing up ${vol}..."
    local vol_file="${dest}/${vol}.tar.gz"
    podman exec "$ctr" tar czf - -C /app/uploads . > "$vol_file"
    local vol_size
    vol_size=$(du -h "$vol_file" | cut -f1)
    success "${vol}: ${vol_file} (${vol_size})"
    (( vol_count++ ))
  done

  # ── 3. Manifest ──
  cat > "${dest}/manifest.txt" <<MANIFEST
HLEcosystem Backup
Created: $(date -Iseconds)
Host: $(hostname)

Database:
  foxxlab.sql.gz — full pg_dump of foxxlab DB (all schemas)

Upload Volumes (${vol_count}):
$(for vol in "${!UPLOAD_VOLUMES[@]}"; do
  [[ -f "${dest}/${vol}.tar.gz" ]] && echo "  ${vol}.tar.gz"
done)

Restore with:
  ./hle restore ${tag}
MANIFEST

  # ── Summary ──
  header "Backup Complete"
  local total_size
  total_size=$(du -sh "$dest" | cut -f1)
  echo -e "  Location:  ${BOLD}${dest}${NC}"
  echo -e "  Total size: ${BOLD}${total_size}${NC}"
  echo -e "  Database:   foxxlab.sql.gz"
  echo -e "  Volumes:    ${vol_count} upload volumes"
  echo ""
  echo -e "  Restore with: ${CYAN}./hle restore ${tag}${NC}"
}

cmd_restore() {
  local tag="${1:-}"

  # If no tag, list available backups
  if [[ -z "$tag" ]]; then
    header "Available Backups"
    if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]]; then
      warn "No backups found in ${BACKUP_DIR}"
      exit 1
    fi
    for d in "${BACKUP_DIR}"/*/; do
      local name
      name=$(basename "$d")
      local size
      size=$(du -sh "$d" | cut -f1)
      local has_db="no"
      [[ -f "${d}foxxlab.sql.gz" ]] && has_db="yes"
      local vol_files
      vol_files=$(find "$d" -name '*.tar.gz' | wc -l)
      printf "  ${BOLD}%-20s${NC}  %6s  db:%s  volumes:%d\n" "$name" "$size" "$has_db" "$vol_files"
    done
    echo ""
    echo -e "  Usage: ${CYAN}./hle restore <tag>${NC}"
    return
  fi

  local src="${BACKUP_DIR}/${tag}"
  if [[ ! -d "$src" ]]; then
    error "Backup not found: ${src}"
    echo "Run './hle restore' to list available backups."
    exit 1
  fi

  header "Restore from ${src}"
  warn "This will OVERWRITE the current database and upload files."
  read -rp "Are you sure? (y/N) " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    info "Aborted."
    exit 0
  fi

  # ── 1. Ensure postgres is running ──
  local pg_state
  pg_state=$(podman inspect --format '{{.State.Status}}' foxxlab-postgres 2>/dev/null || echo "missing")
  if [[ "$pg_state" != "running" ]]; then
    error "PostgreSQL is not running. Start it first: hle up all"
    exit 1
  fi

  # ── 2. Restore database ──
  local db_file="${src}/foxxlab.sql.gz"
  if [[ -f "$db_file" ]]; then
    info "Restoring database from ${db_file}..."

    # Drop active connections
    podman exec foxxlab-postgres psql \
      -U "${POSTGRES_USER:-foxxlab_admin}" \
      -d postgres \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'foxxlab' AND pid <> pg_backend_pid();" \
      > /dev/null 2>&1 || true

    gunzip -c "$db_file" | podman exec -i foxxlab-postgres psql \
      -U "${POSTGRES_USER:-foxxlab_admin}" \
      -d postgres \
      --set ON_ERROR_STOP=off \
      > /dev/null 2>&1

    success "Database restored"
  else
    warn "No database dump found — skipping"
  fi

  # ── 3. Restore upload volumes ──
  for vol in "${!UPLOAD_VOLUMES[@]}"; do
    local vol_file="${src}/${vol}.tar.gz"
    if [[ ! -f "$vol_file" ]]; then
      continue
    fi

    local ctr="${UPLOAD_VOLUMES[$vol]}"
    local ctr_state
    ctr_state=$(podman inspect --format '{{.State.Status}}' "$ctr" 2>/dev/null || echo "missing")

    if [[ "$ctr_state" != "running" ]]; then
      warn "Skipping ${vol} — container ${ctr} not running"
      continue
    fi

    info "Restoring ${vol}..."
    cat "$vol_file" | podman exec -i "$ctr" tar xzf - -C /app/uploads
    success "${vol} restored"
  done

  # ── 4. Run migrations to ensure schema is current ──
  info "Running migrations on all apps..."
  for svc in "${SERVICES[@]}"; do
    local ctr="${CONTAINERS[$svc]}"
    local ctr_state
    ctr_state=$(podman inspect --format '{{.State.Status}}' "$ctr" 2>/dev/null || echo "missing")
    if [[ "$ctr_state" == "running" ]]; then
      podman exec "$ctr" npx prisma migrate deploy 2>/dev/null || true
    fi
  done
  success "Migrations applied"

  header "Restore Complete"
  echo -e "  Restart apps to pick up restored data:"
  echo -e "  ${CYAN}./hle restart all${NC}"
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
  ${GREEN}rebuild${NC}  [service|all] [--no-cache]   Build & restart (${MAX_PARALLEL} concurrent when "all")
  ${GREEN}up${NC}       [service|all]                 Start services
  ${GREEN}down${NC}     [service|all]                 Stop services
  ${GREEN}restart${NC}  [service|all]                 Restart without rebuilding
  ${GREEN}status${NC}                                 Show status & health checks
  ${GREEN}logs${NC}     <service> [--follow]          View container logs
  ${GREEN}shell${NC}    <service|postgres>            Open shell in container
  ${GREEN}backup${NC}                                 Full backup: database + upload volumes
  ${GREEN}restore${NC}  [tag]                          Restore from backup (list if no tag given)
  ${GREEN}clean${NC}                                  Remove stopped containers & dangling images
  ${GREEN}nuke${NC}                                   Full teardown (containers, images, volumes)

${BOLD}SERVICES${NC} (${#SERVICES[@]} apps)
  hle-family-manager    :8080   Family Manager (auth)
  hle-familyhub         :8081   FamilyHub
  hle-family-finance    :8082   Family Finance
  hle-family-health     :8083   Family Health
  hle-family-home-care  :8084   Home Care
  hle-file-server       :8085   File Server
  hle-meal-prep         :8086   Meal Prep
  hle-family-wiki       :8087   Family Wiki
  postgres              (logs/shell only)

${BOLD}EXAMPLES${NC}
  hle rebuild hle-familyhub           Rebuild single service
  hle rebuild hle-familyhub --no-cache Rebuild with no cache
  hle rebuild all                     Rebuild all ${#SERVICES[@]} services
  hle status                          Check all health endpoints
  hle logs hle-family-finance -f      Tail logs
  hle shell postgres                  Open psql session
  hle backup                           Snapshot DB + all uploads
  hle restore                          List available backups
  hle restore 20260324_120000          Restore specific backup
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
  backup)   cmd_backup ;;
  restore)  cmd_restore "${2:-}" ;;
  clean)    cmd_clean ;;
  nuke)     cmd_nuke ;;
  *)        usage ;;
esac
