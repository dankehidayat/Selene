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
HEALTH_MAX_RETRIES=60  # 5 minutes total

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
  local msg="[$(date +'%F %T')] $*"
  echo -e "${BLUE}${msg}${NC}" | tee -a "${LOG_FILE}"
}

log_success() {
  log -e "${GREEN}✓ $*${NC}"
}

log_warning() {
  log -e "${YELLOW}⚠ $*${NC}"
}

log_error() {
  log -e "${RED}✗ $*${NC}" >&2
}

get_log_file() {
  LOG_DIR=$(mkdir -p "$LOG_DIR")
  LOG_FILE="${LOG_DIR}/${LOG_PREFIX}-$(date +%Y%m%d-%H%M%S).log"
}

check_prerequisites() {
  local missing=""
  
  command -v docker >/dev/null 2>&1 || missing+="Docker "
  command -v docker-compose >/dev/null 2>&1 || missing+="Compose "
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
  
  # Check monolith API
  if ! curl -sf http://localhost:8787/health >/dev/null 2>&1; then
    log_error "Monolith (/api) not healthy"
    unhealthy=$((unhealthy + 1))
  else
    log_success "Monolith API healthy"
  fi
  
  # Check EMQX dashboard
  if ! curl -sf http://localhost:18083/api/v5/liveness >/dev/null 2>&1; then
    log_warning "EMQX dashboard check failed (might be slow to start)"
  else
    log_success "EMQX broker healthy"
  fi
  
  # Check frontend
  if ! curl -sf http://localhost:${FRONTEND_PORT:-3000}/ >/dev/null 2>&1; then
    log_warning "Frontend not responding yet"
  else
    log_success "Frontend responding"
  fi
  
  return $unhealthy
}

wait_for_health() {
  local service=$1
  local max_wait=$HEALTH_MAX_RETRIES
  local count=0
  
  log "Waiting for $service to become healthy..."
  
  while [ $count -lt $max_wait ]; do
    if eval "curl -sf http://localhost:$2/health >/dev/null 2>&1"; then
      log_success "$service is healthy after ${count} attempts"
      return 0
    fi
    
    sleep $HEALTH_RETRY_INTERVAL
    count=$((count + 1))
    
    if [ $((count % 10)) -eq 0 ]; then
      log_warning "Still waiting for $service (${count}/${max_wait})..."
    fi
  done
  
  log_error "$service did not become healthy within ${max_wait} retries"
  return 1
}

deploy() {
  log "=========================================="
  log "Starting production deployment"
  log "=========================================="
  
  # Pre-flight checks
  check_prerequisites || exit 1
  git_status_check
  
  # Backup current state
  backup_compose_config || exit 1
  
  # Pull latest code
  log "Pulling latest code from origin/master..."
  git pull origin master || {
    log_error "Git pull failed. Aborting."
    exit 1
  }
  log_success "Code updated"
  
  # Stop old containers gracefully
  log "Stopping existing services (graceful shutdown)..."
  docker compose -f "$COMPOSE_FILE" stop -t 30 || true
  
  # Remove stopped containers
  log "Removing stopped containers..."
  docker compose -f "$COMPOSE_FILE" rm -f --force || true
  
  # Build new images (Docker will use cache efficiently)
  log "Building Docker images (this may take a few minutes)..."
  docker compose -f "$COMPOSE_FILE" build --pull --parallel
  
  if [ $? -ne 0 ]; then
    log_error "Build failed! Check logs above."
    exit 1
  fi
  log_success "Build complete"
  
  # Start fresh containers
  log "Starting new containers..."
  docker compose -f "$COMPOSE_FILE" up -d --no-recreate
  
  # Wait for services to be healthy
  log "Waiting for services to stabilize..."
  sleep 15  # Initial wait for startup
  
  if ! check_services_health; then
    log_error "Health check failed! Services are not healthy."
    log "Consider rolling back or investigating:"
    docker compose -f "$COMPOSE_FILE" logs --tail 50
    exit 1
  fi
  
  log_success "All services are healthy!"
  
  # Cleanup unused images
  log "Cleaning up unused Docker images..."
  docker image prune -af --filter="until=24h" >/dev/null 2>&1 || true
  
  log_success "=========================================="
  log_success "Deployment completed successfully!"
  log_success "Check logs at: $(ls -t ${LOG_DIR}/${LOG_PREFIX}*.log | head -1)"
  log_success "=========================================="
  
  # Log summary
  log "Service Status:"
  docker compose -f "$COMPOSE_FILE" ps
}

rollback() {
  log "=========================================="
  log "ROLLING BACK deployment"
  log "=========================================="
  
  check_prerequisites || exit 1
  
  if [ ! -v COMPOSE_BACKUP ]; then
    log_error "No backup found. Run 'deploy.sh deploy' first."
    exit 1
  fi
  
  log "Restoring from backup: $COMPOSE_BACKUP"
  
  # Stop everything
  docker compose -f "$COMPOSE_FILE" down
  
  # Restore configuration
  docker stack deploy -c "$COMPOSE_BACKUP" selene || {
    log_error "Rollback failed!"
    exit 1
  }
  
  log_success "Rollback completed"
  log "Monitor services and verify they're running correctly"
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
  log "Recent logs (last 10 entries per service):"
  docker compose -f "$COMPOSE_FILE" logs --tail 10
  
  echo ""
  log "Docker disk usage:"
  docker system df
}

# Main entry point
get_log_file

case "${1:-deploy}" in
  deploy)
    deploy
    ;;
  rollback)
    rollback
    ;;
  health)
    health_check
    ;;
  status)
    status
    ;;
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
    echo ""
    echo "Commands:"
    echo "  deploy   - Deploy latest version with health checks"
    echo "  rollback - Rollback to previous configuration"
    echo "  health   - Quick health check of all services"
    echo "  status   - Show current service status and recent logs"
    echo "  clean    - Remove unused Docker resources"
    ;;
esac
