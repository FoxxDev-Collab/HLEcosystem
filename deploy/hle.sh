#!/bin/bash
# hle — HLEcosystem management (production)
# Usage: ./hle <command> [args]

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

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
  [hle-family-travel]=8089
  [hle-media]=8090
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
  [hle-family-travel]=foxxlab-family-travel
  [hle-media]=foxxlab-media
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
  hle-family-travel
  hle-media
)

# Upload volume → container mapping
declare -A UPLOAD_VOLUMES=(
  [family-finance-uploads]=foxxlab-family-finance
  [home-care-uploads]=foxxlab-family-home-care
  [file-server-uploads]=foxxlab-file-server
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

# ── Commands ──────────────────────────────────────────────────────

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

cmd_pull() {
  header "Pulling latest images"
  podman-compose pull
  success "All images up to date"
  echo -e "  Run ${CYAN}./hle restart all${NC} to apply"
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
    error "Usage: hle logs <service|postgres> [-f]"
    exit 1
  fi

  if [[ "$target" == "postgres" ]]; then
    if [[ "$follow" == "-f" || "$follow" == "--follow" ]]; then
      podman logs -f foxxlab-postgres
    else
      podman logs --tail 100 foxxlab-postgres
    fi
    return
  fi

  validate_service "$target"
  if [[ "$follow" == "-f" || "$follow" == "--follow" ]]; then
    podman logs -f "${CONTAINERS[$target]}"
  else
    podman logs --tail 100 "${CONTAINERS[$target]}"
  fi
}

cmd_shell() {
  local target="${1:-}"
  if [[ -z "$target" ]]; then
    error "Usage: hle shell <service|postgres>"
    exit 1
  fi

  if [[ "$target" == "postgres" ]]; then
    podman exec -it foxxlab-postgres psql -U "${POSTGRES_USER:-foxxlab_admin}" -d foxxlab
    return
  fi

  validate_service "$target"
  podman exec -it "${CONTAINERS[$target]}" /bin/sh
}

# ── Backup / Restore ─────────────────────────────────────────────
BACKUP_DIR="${PROJECT_DIR}/backups"

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
    error "PostgreSQL is not running. Start it first: ./hle up"
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
  success "Database dump: foxxlab.sql.gz (${db_size})"

  # ── 2. Upload volumes ──
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
    success "${vol}: ${vol_size}"
    (( vol_count++ ))
  done

  # ── 3. Manifest ──
  cat > "${dest}/manifest.txt" <<MANIFEST
HLEcosystem Backup
Created: $(date -Iseconds)
Host: $(hostname)

Database:
  foxxlab.sql.gz — full pg_dump of foxxlab DB (all 9 schemas)

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
  echo -e "  Location:   ${BOLD}${dest}${NC}"
  echo -e "  Total size: ${BOLD}${total_size}${NC}"
  echo -e "  Database:   foxxlab.sql.gz"
  echo -e "  Volumes:    ${vol_count} upload archives"
  echo ""
  echo -e "  Restore with: ${CYAN}./hle restore ${tag}${NC}"
}

cmd_restore() {
  local tag="${1:-}"

  # List available backups if no tag
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
    error "PostgreSQL is not running. Start it first: ./hle up"
    exit 1
  fi

  # ── 2. Restore database ──
  local db_file="${src}/foxxlab.sql.gz"
  if [[ -f "$db_file" ]]; then
    info "Restoring database..."

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

# ── Usage ─────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}hle${NC} — HLEcosystem management (production)

${BOLD}USAGE${NC}
  ./hle <command> [service|all] [flags]

${BOLD}COMMANDS${NC}
  ${GREEN}up${NC}       [service|all]           Start services
  ${GREEN}down${NC}     [service|all]           Stop services
  ${GREEN}restart${NC}  [service|all]           Restart services
  ${GREEN}pull${NC}                             Pull latest images from registry
  ${GREEN}status${NC}                           Show status & health checks
  ${GREEN}logs${NC}     <service|postgres> [-f] View container logs
  ${GREEN}shell${NC}    <service|postgres>      Open shell in container
  ${GREEN}backup${NC}                           Full backup: database + uploads
  ${GREEN}restore${NC}  [tag]                   Restore from backup (list if no tag)

${BOLD}SERVICES${NC} (${#SERVICES[@]} apps)
  hle-family-manager    :8080   Family Manager (auth)
  hle-familyhub         :8081   FamilyHub
  hle-family-finance    :8082   Family Finance
  hle-family-health     :8083   Family Health
  hle-family-home-care  :8084   Home Care
  hle-file-server       :8085   File Server
  hle-meal-prep         :8086   Meal Prep
  hle-family-wiki       :8087   Family Wiki
  hle-claude-api        :8088   Claude API Gateway
  hle-family-travel     :8089   Family Travel
  postgres              (logs/shell only)

${BOLD}EXAMPLES${NC}
  ./hle up                               Start everything
  ./hle status                           Check all health endpoints
  ./hle logs hle-family-finance -f       Tail logs
  ./hle shell postgres                   Open psql session
  ./hle pull && ./hle restart all        Update to latest images
  ./hle backup                           Snapshot DB + all uploads
  ./hle restore                          List available backups
  ./hle restore 20260324_120000          Restore specific backup
EOF
}

# ── Main ──────────────────────────────────────────────────────────
case "${1:-}" in
  up)       cmd_up "${2:-}" ;;
  down)     cmd_down "${2:-}" ;;
  restart)  cmd_restart "${2:-}" ;;
  pull)     cmd_pull ;;
  status)   cmd_status ;;
  logs)     cmd_logs "${2:-}" "${3:-}" ;;
  shell)    cmd_shell "${2:-}" ;;
  backup)   cmd_backup ;;
  restore)  cmd_restore "${2:-}" ;;
  *)        usage ;;
esac
