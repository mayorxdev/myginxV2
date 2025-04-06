#!/bin/bash

# protect_evilginx.sh
# This script ensures the .evilginx directory is never deleted or overwritten,
# by creating backups and monitoring for accidental deletions

# Configuration
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
BACKUP_DIR="$WORKSPACE_DIR/.evilginx_backups/$(date +%Y%m%d_%H%M%S)"
CURRENT_USER=$(whoami)
GROUP=$(id -gn)

# Print colored output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
  echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if .evilginx directory exists
if [[ ! -d "$EVILGINX_DIR" ]]; then
  error "The .evilginx directory doesn't exist at $EVILGINX_DIR!"
  
  # Check if we have a backup to restore
  LATEST_BACKUP=""
  if [[ -d "$WORKSPACE_DIR/.evilginx_backups" ]]; then
    LATEST_BACKUP=$(find "$WORKSPACE_DIR/.evilginx_backups" -type d -name "*" | sort -r | head -n 1)
  fi
  
  if [[ -n "$LATEST_BACKUP" && -d "$LATEST_BACKUP" ]]; then
    warning "Found a backup at: $LATEST_BACKUP"
    warning "Restoring from backup..."
    
    # Create the directory and restore from backup
    mkdir -p "$EVILGINX_DIR"
    chmod 755 "$EVILGINX_DIR"
    chown "$CURRENT_USER:$GROUP" "$EVILGINX_DIR"
    
    # Copy the backup files
    cp -r "$LATEST_BACKUP"/* "$EVILGINX_DIR"/ 2>/dev/null || true
    
    log "Restored .evilginx directory from backup."
  else
    # No backup found - use the initial setup script
    error "No backup found. You need to create the .evilginx directory manually."
    error "Run the initial_setup.sh script if this is your first time setting up."
    exit 1
  fi
else
  log "Found .evilginx directory at: $EVILGINX_DIR"
  
  # Create backup of existing .evilginx
  log "Creating backup of .evilginx directory..."
  mkdir -p "$BACKUP_DIR"
  chmod 755 "$BACKUP_DIR"
  chown "$CURRENT_USER:$GROUP" "$BACKUP_DIR"
  
  # Backup key files
  for file in "config.json" "blacklist.txt" "data.db"; do
    if [[ -f "$EVILGINX_DIR/$file" ]]; then
      cp "$EVILGINX_DIR/$file" "$BACKUP_DIR/$file"
      log "Backed up $file to $BACKUP_DIR"
    fi
  done
  
  # Backup crt directory if it exists
  if [[ -d "$EVILGINX_DIR/crt" ]]; then
    mkdir -p "$BACKUP_DIR/crt"
    cp -r "$EVILGINX_DIR/crt"/* "$BACKUP_DIR/crt"/ 2>/dev/null || true
    log "Backed up crt directory"
  fi
fi

# Make sure required files exist - don't create them, just check
FILES_TO_CHECK=(
  "blacklist.txt"
  "config.json"
  "data.db"
)

MISSING_FILES=0
for file in "${FILES_TO_CHECK[@]}"; do
  if [[ ! -f "$EVILGINX_DIR/$file" ]]; then
    warning "File $file is missing from .evilginx directory!"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

if [[ $MISSING_FILES -gt 0 ]]; then
  warning "$MISSING_FILES required files are missing."
  warning "Consider running initial_setup.sh if this is your first time setting up."
fi

# Set up a file monitor to detect accidental deletions
(
  while true; do
    if [[ ! -d "$EVILGINX_DIR" ]]; then
      # Directory was deleted - restore from our backup
      error "CRITICAL: .evilginx directory was deleted during operation!"
      mkdir -p "$EVILGINX_DIR"
      chmod 755 "$EVILGINX_DIR"
      chown "$CURRENT_USER:$GROUP" "$EVILGINX_DIR"
      
      # Restore files from backup
      cp -r "$BACKUP_DIR"/* "$EVILGINX_DIR"/ 2>/dev/null || true
      error "Emergency restore completed from backup at $BACKUP_DIR"
    fi
    
    # Check every 5 seconds
    sleep 5
  done
) &

MONITOR_PID=$!

# Setup trap to kill the monitor when this script exits
trap "kill $MONITOR_PID 2>/dev/null || true" EXIT

log "Protection enabled - .evilginx directory will be monitored for accidental deletion"
log "Backup created at: $BACKUP_DIR" 