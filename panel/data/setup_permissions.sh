#!/bin/bash

# Configuration
CURRENT_USER=$(whoami)
GROUP=$(id -gn)
HOME_DIR=$HOME
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
PANEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PANEL_DIR/data"

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

log "===== SETUP PERMISSIONS SCRIPT ====="
log "IMPORTANT: This script NEVER creates files in the .evilginx directory"
log "It only ensures panel/data directory permissions and creates symlinks if needed"

# Ensure panel data directory exists
if [[ ! -d "$DATA_DIR" ]]; then
  mkdir -p "$DATA_DIR"
  chmod 755 "$DATA_DIR"
  chown $CURRENT_USER:$GROUP "$DATA_DIR"
  log "Created panel data directory: $DATA_DIR"
else
  chmod 755 "$DATA_DIR"
  chown $CURRENT_USER:$GROUP "$DATA_DIR"
  log "Panel data directory already exists: $DATA_DIR"
fi

# Verify .evilginx directory exists - DO NOT CREATE IT
if [[ ! -d "$EVILGINX_DIR" ]]; then
  error "The .evilginx directory doesn't exist at $EVILGINX_DIR"
  error "This script will NOT create this directory."
  error "You must create it manually before proceeding."
  exit 1
else
  log "Found .evilginx directory at: $EVILGINX_DIR"
fi

# Files to symlink from .evilginx - MUST already exist
FILES_TO_SYNC=(
  "blacklist.txt"
  "config.json"
  "data.db"
)

# Local files to create (not from .evilginx)
LOCAL_FILES=(
  "auth.db"
)

# Create local files like auth.db
create_local_files() {
  log "Creating local files that aren't symlinked..."
  
  for file in "${LOCAL_FILES[@]}"; do
    local_file="$DATA_DIR/$file"
    
    if [[ ! -f "$local_file" ]]; then
      log "Creating $file in panel/data directory..."
      
      if [[ "$file" == "auth.db" ]]; then
        # Create an empty auth.db - database service will initialize it
        touch "$local_file"
        log "Created empty auth.db (will be initialized by database service)"
      else
        # Handle other local files if needed
        touch "$local_file"
      fi
      
      chmod 644 "$local_file"
      chown $CURRENT_USER:$GROUP "$local_file"
    else
      log "Local file $file already exists"
    fi
  done
}

# Check if required files exist in .evilginx directory - DO NOT CREATE THEM
check_evilginx_files() {
  log "Checking for required files in .evilginx directory..."
  local all_exists=true
  
  for file in "${FILES_TO_SYNC[@]}"; do
    evilginx_file="$EVILGINX_DIR/$file"
    
    if [[ ! -f "$evilginx_file" ]]; then
      error "File $file doesn't exist in .evilginx directory!"
      error "This script will NOT create this file."
      error "You must create it manually before setting up symlinks."
      all_exists=false
    else
      log "✅ $file exists in .evilginx directory"
    fi
  done
  
  if [[ "$all_exists" == "false" ]]; then
    error "Some required files are missing from .evilginx directory."
    error "Please create these files manually before proceeding."
    exit 1
  fi
  
  log "All required files exist in .evilginx directory."
}

# Create symlinks from panel/data to .evilginx files
create_symlinks() {
  log "Creating symlinks from panel/data to .evilginx files..."
  
  for file in "${FILES_TO_SYNC[@]}"; do
    evilginx_file="$EVILGINX_DIR/$file"
    panel_file="$DATA_DIR/$file"
    
    # Check if source file exists first - DO NOT CREATE IT
    if [[ ! -f "$evilginx_file" ]]; then
      error "Source file $evilginx_file doesn't exist, cannot create symlink"
      error "This script will NOT create this file."
      error "You must create it manually before proceeding."
      continue
    fi
    
    # Check if symlink already exists and points to the correct file
    if [[ -L "$panel_file" ]]; then
      local target=$(readlink "$panel_file")
      if [[ "$target" == "../../../.evilginx/$file" ]]; then
        log "✅ $file is already properly symlinked"
        continue
      else
        warning "Symlink for $file points to wrong target: $target"
        read -p "Do you want to fix this symlink? (y/n): " choice
        if [[ "$choice" == "y" || "$choice" == "Y" ]]; then
          log "Removing incorrect symlink for $file"
          rm -f "$panel_file"
        else
          warning "Keeping existing symlink. This may cause issues."
          continue
        fi
      fi
    elif [[ -e "$panel_file" && ! -L "$panel_file" ]]; then
      # Regular file exists, not a symlink
      warning "Found regular file $panel_file instead of symlink"
      warning "This may indicate that you have custom data that should not be overwritten"
      read -p "Do you want to replace it with a symlink to the .evilginx file? (y/n): " choice
      if [[ "$choice" == "y" || "$choice" == "Y" ]]; then
        warning "Moving original file to $panel_file.bak"
        mv "$panel_file" "$panel_file.bak"
      else
        warning "Keeping existing file. This may cause issues with synchronization."
        continue
      fi
    fi
    
    # Create the symlink from panel/data to .evilginx using relative path
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
  
  log "Symlinks created successfully."
}

# Verify symlinks are working correctly
verify_symlinks() {
  log "Verifying symlinks..."
  local all_valid=true
  
  for file in "${FILES_TO_SYNC[@]}"; do
    evilginx_file="$EVILGINX_DIR/$file"
    panel_file="$DATA_DIR/$file"
    
    # Check if the file exists in .evilginx
    if [[ ! -f "$evilginx_file" ]]; then
      error "$file doesn't exist in .evilginx directory!"
      all_valid=false
      continue
    fi
    
    # Check if the symlink exists
    if [[ ! -L "$panel_file" ]]; then
      error "$file in panel/data is not a symlink!"
      all_valid=false
      continue
    fi
    
    # Check if the symlink points to the correct file
    local target=$(readlink "$panel_file")
    if [[ "$target" != "../../../.evilginx/$file" ]]; then
      error "$file symlink points to wrong target: $target"
      all_valid=false
      continue
    fi
    
    # Check if the file is accessible through the symlink
    if [[ ! -f "$panel_file" ]]; then
      error "$file symlink exists but target is not accessible!"
      all_valid=false
      continue
    else
      log "✅ $file symlink is valid and accessible"
    fi
  done
  
  if [[ "$all_valid" == "true" ]]; then
    log "✅ All symlinks are valid and working correctly!"
    return 0
  else
    warning "Some symlinks are invalid or not working correctly."
    return 1
  fi
}

# Run steps in proper order - NEVER CREATE .evilginx FILES
log "Checking for required files and permissions"
check_evilginx_files
create_local_files
create_symlinks
verify_symlinks

log "=== Setup complete ==="
log "Now run: cd \"$PANEL_DIR\" && npm run dev" 