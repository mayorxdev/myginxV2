#!/bin/bash

# verify_integrity.sh
# This script verifies the integrity of .evilginx files and creates backups
# Run this before starting the panel to ensure your files are preserved

# Configuration
CURRENT_USER=$(whoami)
GROUP=$(id -gn)
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
PANEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PANEL_DIR/data"
BACKUP_DIR="$WORKSPACE_DIR/.evilginx_backups/$(date +%Y%m%d_%H%M%S)"

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

# Print header
echo -e "${BLUE}=================================================================${NC}"
echo -e "${BLUE}             EVILGINX FILE INTEGRITY VERIFICATION               ${NC}"
echo -e "${BLUE}=================================================================${NC}"
echo ""

# Check if .evilginx directory exists
if [[ ! -d "$EVILGINX_DIR" ]]; then
  error "The .evilginx directory doesn't exist at $EVILGINX_DIR!"
  error "You need to create this directory and populate it with required files."
  error "Run initial_setup.sh if this is your first time setting up the panel."
  exit 1
fi

log "Checking .evilginx directory and files..."

# Required files to check
FILES_TO_CHECK=(
  "blacklist.txt"
  "config.json"
  "data.db"
)

# Check if required files exist and create backups if needed
MISSING_FILES=0
BACKUP_CREATED=false

for file in "${FILES_TO_CHECK[@]}"; do
  evilginx_file="$EVILGINX_DIR/$file"
  
  if [[ ! -f "$evilginx_file" ]]; then
    error "File $file doesn't exist in .evilginx directory!"
    MISSING_FILES=$((MISSING_FILES + 1))
  else
    # Check file size
    filesize=$(stat -f%z "$evilginx_file" 2>/dev/null || stat -c%s "$evilginx_file")
    
    if [[ $filesize -gt 0 ]]; then
      log "✅ $file exists and has content ($filesize bytes)"
      
      # Create backup of non-empty files
      if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        chmod 755 "$BACKUP_DIR"
        chown "$CURRENT_USER:$GROUP" "$BACKUP_DIR"
      fi
      
      cp "$evilginx_file" "$BACKUP_DIR/$file"
      BACKUP_CREATED=true
      info "Backup created: $BACKUP_DIR/$file"
    else
      warning "$file exists but is empty (size: $filesize bytes)"
    fi
  fi
done

if [[ $MISSING_FILES -gt 0 ]]; then
  error "$MISSING_FILES required files are missing from .evilginx directory."
  error "You should run initial_setup.sh if this is your first time setting up."
  exit 1
fi

# Check symlinks in panel/data directory
log "Checking symlinks in panel/data directory..."

for file in "${FILES_TO_CHECK[@]}"; do
  panel_file="$DATA_DIR/$file"
  
  if [[ ! -L "$panel_file" ]]; then
    warning "$file in panel/data is not a symlink!"
    warning "This will be fixed when you run the sync script."
  else
    target=$(readlink "$panel_file")
    if [[ "$target" == "../../../.evilginx/$file" ]]; then
      log "✅ $file is properly symlinked to .evilginx"
    else
      warning "$file symlink points to incorrect target: $target"
      warning "Should point to: ../../../.evilginx/$file"
      warning "This will be fixed when you run the sync script."
    fi
  fi
done

if [[ "$BACKUP_CREATED" == "true" ]]; then
  log "Backups created in: $BACKUP_DIR"
  info "If your files get reset, you can restore from this backup."
fi

log "Verification completed."
echo ""
info "Next steps:"
info "1. If you're missing files, run initial_setup.sh (first-time setup only)"
info "2. If symlinks are incorrect, run init_sync_watch.sh"
info "3. Start the panel with: cd $PANEL_DIR && npm run dev"
echo ""
echo -e "${GREEN}=================================================================${NC}" 