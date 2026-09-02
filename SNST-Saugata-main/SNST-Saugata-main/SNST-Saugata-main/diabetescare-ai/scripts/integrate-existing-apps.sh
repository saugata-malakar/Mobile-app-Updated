#!/usr/bin/env bash
#
# Integrate existing DiabetesCare product code into the diabetescare-ai monorepo.
#
# Usage:
#   ./scripts/integrate-existing-apps.sh
#   ./scripts/integrate-existing-apps.sh --dry-run
#
# Sources (override with env vars if needed):
#   SRC_MOBILE=/Users/dipak/HealthScreenApp
#   SRC_BACKEND=/Users/dipak/HealthScreeningApp/backend
#   SRC_DOCTOR=/Users/dipak/HealthScreeningApp/doctor-dashboard
#   DEST_REPO=/Users/dipak/diabetescare-ai

set -u

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  echo "=== DRY RUN (no files will be written) ==="
  echo
fi

SRC_MOBILE="${SRC_MOBILE:-/Users/dipak/HealthScreenApp}"
SRC_BACKEND="${SRC_BACKEND:-/Users/dipak/HealthScreeningApp/backend}"
SRC_DOCTOR="${SRC_DOCTOR:-/Users/dipak/HealthScreeningApp/doctor-dashboard}"
DEST_REPO="${DEST_REPO:-/Users/dipak/diabetescare-ai}"

DEST_MOBILE="${DEST_REPO}/mobile-app"
DEST_BACKEND="${DEST_REPO}/backend/legacy"
DEST_DOCTOR="${DEST_REPO}/doctor-dashboard"

LOG_DIR="${DEST_REPO}/scripts/integration-logs"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SUMMARY_LOG="${LOG_DIR}/integrate-${TIMESTAMP}.summary.log"
DETAIL_LOG="${LOG_DIR}/integrate-${TIMESTAMP}.detail.log"

# Shared rsync excludes (secrets, deps, caches, build artifacts)
RSYNC_EXCLUDES=(
  --exclude '.git/'
  --exclude 'node_modules/'
  --exclude 'venv/'
  --exclude '.venv/'
  --exclude '__pycache__/'
  --exclude '*.py[cod]'
  --exclude '.pytest_cache/'
  --exclude '.mypy_cache/'
  --exclude '.env'
  --exclude '.env.*'
  --exclude 'secrets/'
  --exclude 'credentials.json'
  --exclude '*.pem'
  --exclude '*.key'
  --exclude '.DS_Store'
  --exclude 'Thumbs.db'
  --exclude '.idea/'
  --exclude '.vscode/'
  --exclude 'npm-debug.log*'
  --exclude 'yarn-error.log*'
  --exclude 'android/app/build/'
  --exclude 'android/build/'
  --exclude 'android/.gradle/'
  --exclude 'ios/build/'
  --exclude 'DerivedData/'
  --exclude '*.xcuserstate'
  --exclude 'wandb/'
  --exclude 'mlruns/'
)

ERRORS=0
COPIED_COUNTS=()

log() {
  echo "[$(date +%H:%M:%S)] $*"
}

die() {
  log "ERROR: $*"
  exit 1
}

check_source() {
  local label="$1"
  local path="$2"
  if [[ ! -d "$path" ]]; then
    log "ERROR: ${label} source not found: ${path}"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
  return 0
}

count_new_files() {
  local detail_file="$1"
  # rsync itemize: leading '>' means a file was transferred (new or updated)
  # With --ignore-existing, '>' lines are new files only on destination
  grep -c '^>f' "$detail_file" 2>/dev/null || echo 0
}

sync_tree() {
  local label="$1"
  local src="$2"
  local dest="$3"

  log "----------------------------------------"
  log "${label}"
  log "  From: ${src}/"
  log "  To:   ${dest}/"

  if ! check_source "$label" "$src"; then
    return 1
  fi

  mkdir -p "$dest" "$LOG_DIR"

  local detail="${LOG_DIR}/${label// /_}-${TIMESTAMP}.detail.log"
  local rsync_flags=(-a --human-readable --ignore-existing --itemize-changes)

  if [[ "$DRY_RUN" -eq 1 ]]; then
    rsync_flags+=(--dry-run)
  fi

  log "  Syncing (skip existing destination files)..."

  set +e
  rsync "${rsync_flags[@]}" "${RSYNC_EXCLUDES[@]}" \
    "${src}/" "${dest}/" \
    2>&1 | tee "$detail" | tee -a "$DETAIL_LOG"
  local rsync_exit=${PIPESTATUS[0]}
  set -e

  if [[ "$rsync_exit" -gt 1 ]]; then
    log "  rsync failed with exit code ${rsync_exit}"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  local n
  n="$(count_new_files "$detail")"
  COPIED_COUNTS+=("${label}:${n} new file(s)")
  log "  Done: ${n} new file(s) would be copied$([[ "$DRY_RUN" -eq 1 ]] && echo ' (dry-run)' || echo '')"
  log "  Detail log: ${detail}"

  # Append transferred paths to summary (basename lines only for readability)
  {
    echo "=== ${label} ==="
    grep '^>f' "$detail" | awk '{print $NF}' | head -500
    local total
    total="$(grep -c '^>f' "$detail" 2>/dev/null || echo 0)"
    if [[ "$total" -gt 500 ]]; then
      echo "... and $((total - 500)) more (see detail log)"
    fi
    echo
  } >> "$SUMMARY_LOG"

  return 0
}

main() {
  log "DiabetesCare AI — integrate existing apps"
  log "Destination repo: ${DEST_REPO}"
  echo

  if [[ ! -d "$DEST_REPO" ]]; then
    die "Destination repo does not exist: ${DEST_REPO}"
  fi

  mkdir -p "$LOG_DIR"
  : > "$SUMMARY_LOG"
  : > "$DETAIL_LOG"

  sync_tree "Mobile app" "$SRC_MOBILE" "$DEST_MOBILE" || true
  sync_tree "Backend legacy" "$SRC_BACKEND" "$DEST_BACKEND" || true
  sync_tree "Doctor dashboard" "$SRC_DOCTOR" "$DEST_DOCTOR" || true

  echo
  log "========================================"
  log "Summary"
  log "========================================"
  for entry in "${COPIED_COUNTS[@]}"; do
    log "  ${entry}"
  done
  log "  Summary log: ${SUMMARY_LOG}"
  log "  Full detail: ${DETAIL_LOG}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry-run complete. Re-run without --dry-run to copy files."
  fi

  if [[ "$ERRORS" -gt 0 ]]; then
    log "Completed with ${ERRORS} error(s)."
    exit 1
  fi

  log "Integration finished successfully."
}

main "$@"
