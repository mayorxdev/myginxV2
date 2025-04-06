#!/bin/bash

# IMPORTANT NOTE: This script NEVER creates files in the .evilginx directory.
# It only creates symlinks in the panel/data directory that point to EXISTING files in .evilginx.
# The .evilginx files must already exist before running this script.

# Configuration
HOME_DIR=$HOME
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
# DO NOT USE HOME_DIR/.evilginx - we explicitly want the workspace version
PANEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PANEL_DIR/data"
CURRENT_USER=$(whoami)
GROUP=$(id -gn)

# Debug - print paths
echo "DEBUG: WORKSPACE_DIR = $WORKSPACE_DIR"
echo "DEBUG: EVILGINX_DIR = $EVILGINX_DIR"
echo "DEBUG: PANEL_DIR = $PANEL_DIR"
echo "DEBUG: DATA_DIR = $DATA_DIR"

# Files to sync from .evilginx - MUST ALREADY EXIST, will NOT be created
FILES_TO_SYNC=(
  "blacklist.txt"
  "config.json"
  "data.db"
)

# Local files to create (not from .evilginx)
LOCAL_FILES=(
  "auth.db"
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

# Check if HOME/.evilginx is interfering
check_home_evilginx() {
  log "Checking if $HOME/.evilginx exists and might be interfering..."
  
  if [[ -d "$HOME/.evilginx" ]]; then
    warning "Found $HOME/.evilginx directory which might be interfering with the workspace version."
    
    # Check if running as root - automatically remove without asking
    if [[ "$EUID" -eq 0 || "$USER" == "root" || "$CURRENT_USER" == "root" ]]; then
      log "Running as root user, automatically removing $HOME/.evilginx directory..."
      rm -rf "$HOME/.evilginx"
      log "Removed $HOME/.evilginx directory."
    else
      # For non-root users, ask for confirmation
      read -p "Do you want to remove it? (y/n): " choice
      if [[ "$choice" == "y" || "$choice" == "Y" ]]; then
        log "Removing $HOME/.evilginx directory..."
        rm -rf "$HOME/.evilginx"
        log "Removed $HOME/.evilginx directory."
      else
        warning "Keeping $HOME/.evilginx - be aware it might cause conflicts."
      fi
    fi
  else
    log "No $HOME/.evilginx found. This is good."
  fi
}

# Check if .evilginx directory and required files exist - but NEVER create them
check_evilginx_files() {
  log "Checking if .evilginx directory and required files exist..."
  
  # Check if .evilginx directory exists
  if [[ ! -d "$EVILGINX_DIR" ]]; then
    error "The .evilginx directory doesn't exist! Required for symlinks to work."
    error "This script will NOT create the directory. You must create it manually."
    exit 1
  fi
  
  # Check if crt directory exists
  if [[ ! -d "$EVILGINX_DIR/crt" ]]; then
    warning "The .evilginx/crt directory doesn't exist. You may need to create it manually."
  fi
  
  # Check if required files exist but DO NOT create them
  for file in "${FILES_TO_SYNC[@]}"; do
    evilginx_file="$EVILGINX_DIR/$file"
    
    if [[ ! -f "$evilginx_file" ]]; then
      error "File $file doesn't exist in .evilginx directory!"
      error "This script will NOT create this file. You must create it manually before setting up symlinks."
      exit 1
    else
      log "✅ $file exists in .evilginx directory"
    fi
  done
  
  log "All required files exist in .evilginx directory."
}

# Create local files like auth.db (ONLY in panel/data, NOT in .evilginx)
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

# Create symlinks from panel/data to .evilginx files
create_symlinks() {
  log "Creating symlinks from panel/data to .evilginx files..."
  
  for file in "${FILES_TO_SYNC[@]}"; do
    evilginx_file="$EVILGINX_DIR/$file"
    panel_file="$DATA_DIR/$file"
    
    # Check if source file exists first
    if [[ ! -f "$evilginx_file" ]]; then
      error "Source file $evilginx_file doesn't exist, cannot create symlink"
      error "Please make sure the file exists in .evilginx before running this script."
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

# Initialize everything
init_files() {
  log "==================================================================="
  log "IMPORTANT: This script NEVER creates files in the .evilginx directory."
  log "It only creates symlinks pointing to existing files."
  log "==================================================================="
  
  # Ensure panel data directory exists 
  if [[ ! -d "$DATA_DIR" ]]; then
    mkdir -p "$DATA_DIR"
    chmod 755 "$DATA_DIR"
    chown $CURRENT_USER:$GROUP "$DATA_DIR"
  fi
  
  # Check if .evilginx directory exists with required files
  check_evilginx_files
  
  # Create symlinks from panel/data to .evilginx
  create_symlinks
  
  # Create local files that should not be symlinks
  create_local_files
  
  # Finally verify the symlinks
  verify_symlinks
  
  log "Initialization complete."
}

# Main execution
log "Running one-time file sync..."
echo "==================================================================="
log "WARNING: This script will NEVER create any files in .evilginx directory."
log "All files (.evilginx/config.json, .evilginx/blacklist.txt, .evilginx/data.db)"
log "must already exist before running this script."
echo "==================================================================="
check_home_evilginx
init_files
log "Sync completed. Exiting."
exit 0 