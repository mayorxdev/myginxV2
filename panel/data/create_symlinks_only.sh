#!/bin/bash

# create_symlinks_only.sh
# This script ONLY creates symlinks from panel/data to existing .evilginx files.
# It will NOT create or modify any files in the .evilginx directory.
# Use this when you already have data in .evilginx and just need to set up symlinks.

# Configuration
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
PANEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PANEL_DIR/data"
CURRENT_USER=$(whoami)
GROUP=$(id -gn)

# Files to symlink from .evilginx
FILES_TO_LINK=(
  "blacklist.txt"
  "config.json"
  "data.db"
)

# Print colored output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Print header
log "===== SYMLINK ONLY CREATION SCRIPT ====="
log "This script will ONLY create symlinks from panel/data to existing .evilginx files."
log "It will NOT create or modify any files in the .evilginx directory."
echo ""
log "Current directories:"
echo "Workspace directory: $WORKSPACE_DIR"
echo "Evilginx directory: $EVILGINX_DIR"
echo "Panel directory: $PANEL_DIR"
echo "Panel data directory: $DATA_DIR"
echo ""

# Check if .evilginx directory exists
if [[ ! -d "$EVILGINX_DIR" ]]; then
  error "The .evilginx directory doesn't exist at $EVILGINX_DIR!"
  error "Please create this directory and populate it with the required files first."
  exit 1
fi

# Check for each source file
for file in "${FILES_TO_LINK[@]}"; do
  evilginx_file="$EVILGINX_DIR/$file"
  
  if [[ ! -f "$evilginx_file" ]]; then
    error "File $file doesn't exist in .evilginx directory ($evilginx_file)!"
    error "Please create this file first before creating symlinks."
    exit 1
  else
    log "Found source file: $evilginx_file ✅"
  fi
done

# Create symlinks
log "Creating symlinks from panel/data to .evilginx files..."

for file in "${FILES_TO_LINK[@]}"; do
  evilginx_file="$EVILGINX_DIR/$file"
  panel_file="$DATA_DIR/$file"
  
  # Check if symlink already exists
  if [[ -L "$panel_file" ]]; then
    local target=$(readlink "$panel_file")
    if [[ "$target" == "../../../.evilginx/$file" ]]; then
      log "✅ $file is already properly symlinked"
      continue
    else
      warning "Existing symlink for $file points to: $target"
      read -p "Replace with correct symlink? (y/n): " choice
      if [[ "$choice" != "y" && "$choice" != "Y" ]]; then
        warning "Keeping existing symlink. This may cause issues."
        continue
      fi
      rm -f "$panel_file"
    fi
  elif [[ -e "$panel_file" ]]; then
    # Regular file exists, not a symlink
    warning "Found regular file $panel_file instead of symlink"
    read -p "Backup and replace with symlink? (y/n): " choice
    if [[ "$choice" == "y" || "$choice" == "Y" ]]; then
      backup_file="$panel_file.bak.$(date '+%Y%m%d%H%M%S')"
      log "Backing up to $backup_file"
      mv "$panel_file" "$backup_file"
    else
      warning "Keeping existing file. This may cause issues with synchronization."
      continue
    fi
  fi
  
  # Create the symlink using relative path
  cd "$DATA_DIR"
  log "Creating symlink: $file → ../../../.evilginx/$file"
  ln -sf "../../../.evilginx/$file" "$file"
  
  # Verify the symlink was created
  if [[ -L "$panel_file" ]]; then
    log "✅ Symlink created for $file successfully"
  else
    error "Failed to create symlink for $file"
  fi
done

# Create auth.db if it doesn't exist
AUTH_DB="$DATA_DIR/auth.db"
if [[ ! -f "$AUTH_DB" ]]; then
  log "Creating empty auth.db file for local authentication"
  touch "$AUTH_DB"
  chmod 644 "$AUTH_DB"
  chown $CURRENT_USER:$GROUP "$AUTH_DB"
  log "Created $AUTH_DB"
else
  log "auth.db already exists ✅"
fi

# Verify all symlinks
log "Verifying all symlinks..."
all_valid=true

for file in "${FILES_TO_LINK[@]}"; do
  panel_file="$DATA_DIR/$file"
  
  if [[ ! -L "$panel_file" ]]; then
    error "$file is not a symlink!"
    all_valid=false
    continue
  fi
  
  local target=$(readlink "$panel_file")
  if [[ "$target" != "../../../.evilginx/$file" ]]; then
    error "$file symlink points to wrong target: $target"
    all_valid=false
    continue
  fi
  
  if [[ ! -f "$panel_file" ]]; then
    error "$file symlink exists but target is not accessible!"
    all_valid=false
    continue
  fi
  
  log "✅ $file symlink is valid and accessible"
done

if [[ "$all_valid" == "true" ]]; then
  log "✅ All symlinks are valid and working correctly!"
else
  warning "Some symlinks are invalid or not working correctly."
fi

log "Symlink creation completed."
exit 0 