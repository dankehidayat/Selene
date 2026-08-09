#!/bin/bash
# =============================================================================
# Selene Production Deployment Script
# =============================================================================
# Purpose: Safe, health-checked deployments with rollback capability
# Usage: ./scripts/deploy.sh deploy|rollback|health|status
# =============================================================================

set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.modular.yml"
LOG_DIR="/var/log/selene"
LOG_PREFIX="selene-deploy"
HEALTH_RETRY_INTERVAL=5
HEALTH_MAX_RETRIES=60

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  local msg="[$(date +'%F %T')] $*"
  echo -e "${BLUE}${msg}${NC}" | tee -a "${LOG_FILE}"
}

log_success() { log -e "${GREEN}✓ $*${NC}"; }
log_warning() { log -e "${YELLOW}⚠ $*${NC}"; }
log_error() { log -e "${RED}✗ $*${NC}" >&2; }

get_log_file() {
  LOG_DIR=$(mkdir -p "$LOG_DIR")
  LOG_FILE="${LOG_DIR}/${LOG_PREFIX}-$(date +%Y%m%d-%H%M%S).log"
}

check_prerequisites() {
  local missing=""
  
  command -v docker >/dev/null 2>&1 || missing+="Docker "
  
  # Support both modern Docker Compose and standalone docker-compose
  if ! docker compose version >/dev/null 2>&1 && ! docker-compose --version >/dev/null 2>&1; then
    missing+="Compose "
  fi
  
  command -v git >/dev/null 2>&1 || missing+="Git "
  
  if [ -n "$missing" ]; then
    log_error "Missing required tools: $missing"
    return 1
  fi
  
  [ -f "$COMPOSE_FILE" ] || { log_error "Compose file not found: $COMPOSE_FILE"; return 1; }
  [ -d .git ] || { log_error "Not a git repository"; return 1; }
  
  log_success "Prerequisites satisfied"
}

git_status_check() {
  local dirty
  dirty=$(git status --porcelain 2>/dev/null)
  
  if [ -n "$dirty" ]; then
    log_warning "Working tree is dirty!"
    echo "$dirty"
    read -p "Continue anyway? (y/N): " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  fi
}

backup_compose_config() {
  local backup_file="/tmp/compose-backup-$(date +%Y%m%d-%H%M%S).yaml"
  
  log "Backing up current compose configuration..."
  docker compose -f "$COMPOSE_FILE" config > "$backup_file"
  
  if [ $? -eq 0 ]; then
    log_success "Backup created: $backup_file"
    export COMPOSE_BACKUP="$backup_file"
  else
    log_error "Failed to create backup"
    return 1
  fi
}

check_services_health() {
  local unhealthy=0
  
  log "Checking service health..."
  
  curl -sf http://localhost:8787/health >/dev/null 2>&1 || {
    log_error "Monolith (/api) not healthy"
    unhealthy=$((unhealthy + 1))
  } || log_success "Monolith API healthy"
  
  curl -sf http://localhost:18083/api/v5/liveness >/dev/null 2>&1 || 
    log_warning "EMQX dashboard check failed" || log_success "EMQX broker healthy"
  
  curl -sf http://localhost:${FRONTEND_PORT:-3000}/ >/dev/null 2>&1 || 
    log_warning "Frontend not responding yet" || log_success "Frontend responding"
  
  return $unhealthy
}

deploy() {
  log "=========================================="
  log "Starting production deployment"
  log "=========================================="
  
  check_prerequisites || exit 1
  git_status_check
  backup_compose_config || exit 1
  
  log "Pulling latest code from origin/master..."
  git pull origin master || { log_error "Git pull failed. Aborting."; exit 1; }
  log_success "Code updated"
  
  log "Stopping existing services..."
  docker compose -f "$COMPOSE_FILE" stop -t 30 || true
  
  log "Removing stopped containers..."
  docker compose -f "$COMPOSE_FILE" rm -f --force || true
  
  log "Building Docker images (uses cache)..."
  docker compose -f "$COMPOSE_FILE" build --pull --parallel || {
    log_error "Build failed! Check logs above."
    exit 1
  }
  log_success "Build complete"
  
  log "Starting new containers..."
  docker compose -f "$COMPOSE_FILE" up -d --no-recreate
  
  log "Waiting for services to stabilize (15s)..."
  sleep 15
  
  if ! check_services_health; then
    log_error "Health check failed! Services are not healthy."
    log "Check logs: $(ls -t ${LOG_DIR}/${LOG_PREFIX}*.log | head -1)"
    docker compose -f "$COMPOSE_FILE" logs --tail 50
    exit 1
  fi
  
  log_success "All services are healthy!"
  docker image prune -af --filter="until=24h" >/dev/null 2>&1 || true
  
  log_success "=========================================="
  log_success "Deployment completed successfully!"
  log_success "Logs: $(ls -t ${LOG_DIR}/${LOG_PREFIX}*.log | head -1)"
  log_success "=========================================="
}

rollback() {
  log "=========================================="
  log "ROLLING BACK deployment"
  log "=========================================="
  
  check_prerequisites || exit 1
  
  if [ -z "${COMPOSE_BACKUP:-}" ]; then
    log_error "No backup found in environment"
    exit 1
  fi
  
  log "Restoring from backup: $COMPOSE_BACKUP"
  docker stack deploy -c "$COMPOSE_BACKUP" selene || { log_error "Rollback failed!"; exit 1; }
  log_success "Rollback completed"
}

health_check() {
  log "Performing quick health check..."
  check_services_health && \
    log_success "All systems operational" || \
    log_error "Some services are unhealthy"
}

status() {
  log "Current service status:"
  docker compose -f "$COMPOSE_FILE" ps --all
  echo ""
  log "Recent logs:"
  docker compose -f "$COMPOSE_FILE" logs --tail 10
}

# Main entry point
get_log_file

case "${1:-deploy}" in
  deploy) deploy ;;
  rollback) rollback ;;
  health) health_check ;;
  status) status ;;
  clean)
    log "Cleaning up unused Docker resources..."
    docker container prune -f
    docker volume prune -f
    docker image prune -af
    log_success "Cleanup complete"
    ;;
  *)
    echo "Selene Production Deployment Script"
    echo ""
    echo "Usage: $0 {deploy|rollback|health|status|clean}"
    ;;
esac
