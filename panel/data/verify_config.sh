#!/bin/bash

# Verification script to check state of config files and symlinks
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
PANEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PANEL_DIR/data"

# Print colored output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[INFO] $1${NC}"
}

warn() {
  echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
  echo -e "${RED}[ERROR] $1${NC}"
}

header() {
  echo -e "\n${BLUE}===== $1 =====${NC}"
}

# Files to check
FILES=(
  "config.json"
  "blacklist.txt"
  "data.db"
)

# Print workspace information
header "WORKSPACE INFORMATION"
echo "Workspace directory: $WORKSPACE_DIR"
echo "Evilginx directory: $EVILGINX_DIR"
echo "Panel directory: $PANEL_DIR"
echo "Panel data directory: $DATA_DIR"

# Check if .evilginx directory exists
header "CHECKING DIRECTORIES"
if [[ -d "$EVILGINX_DIR" ]]; then
  log ".evilginx directory exists"
else
  error ".evilginx directory NOT FOUND at $EVILGINX_DIR"
fi

if [[ -d "$DATA_DIR" ]]; then
  log "panel/data directory exists"
else
  error "panel/data directory NOT FOUND at $DATA_DIR"
fi

# Check if there are any background processes running the init_sync_watch.sh script
header "CHECKING BACKGROUND PROCESSES"
SYNC_PROCESSES=$(ps aux | grep init_sync_watch | grep -v grep | wc -l)
if [[ $SYNC_PROCESSES -gt 0 ]]; then
  warn "Found $SYNC_PROCESSES background processes running init_sync_watch.sh"
  ps aux | grep init_sync_watch | grep -v grep
else
  log "No background processes found for init_sync_watch.sh"
fi

# Check each file
header "CHECKING FILES"
for file in "${FILES[@]}"; do
  echo -e "\n${BLUE}File: $file${NC}"
  
  # Check source file in .evilginx
  EVILGINX_FILE="$EVILGINX_DIR/$file"
  if [[ -f "$EVILGINX_FILE" ]]; then
    log "Source file exists in .evilginx directory"
    FILESIZE=$(stat -f%z "$EVILGINX_FILE" 2>/dev/null || stat -c%s "$EVILGINX_FILE")
    echo "  - Size: $FILESIZE bytes"
    if [[ "$file" == "config.json" ]] && [[ $FILESIZE -gt 10 ]]; then
      echo "  - Content summary (first 10 lines):"
      head -n 10 "$EVILGINX_FILE" | sed 's/^/    /'
    elif [[ "$file" == "blacklist.txt" ]]; then
      LINES=$(wc -l < "$EVILGINX_FILE")
      echo "  - Contains $LINES lines"
    elif [[ "$file" == "data.db" ]]; then
      echo "  - Binary database file"
    fi
  else
    error "Source file MISSING in .evilginx directory"
  fi
  
  # Check file in panel/data
  PANEL_FILE="$DATA_DIR/$file"
  if [[ -f "$PANEL_FILE" ]]; then
    # Check if it's a symlink
    if [[ -L "$PANEL_FILE" ]]; then
      TARGET=$(readlink "$PANEL_FILE")
      log "Panel file is a symlink pointing to: $TARGET"
      
      # Verify if the symlink is valid
      if [[ -f "$PANEL_FILE" ]]; then
        log "Symlink target exists and is accessible"
      else
        error "Symlink target does not exist or is not accessible"
      fi
    else
      warn "Panel file exists but is NOT a symlink - this could cause issues"
      FILESIZE=$(stat -f%z "$PANEL_FILE" 2>/dev/null || stat -c%s "$PANEL_FILE")
      echo "  - Size: $FILESIZE bytes"
      if [[ "$file" == "config.json" ]]; then
        echo "  - Content summary (first 10 lines):"
        head -n 10 "$PANEL_FILE" | sed 's/^/    /'
      fi
    fi
  else
    error "Panel file MISSING in panel/data directory"
  fi
done

# Verify if init_sync_watch.sh script exists and is executable
header "CHECKING SCRIPTS"
INIT_SCRIPT="$DATA_DIR/init_sync_watch.sh"
if [[ -f "$INIT_SCRIPT" ]]; then
  log "init_sync_watch.sh script exists"
  if [[ -x "$INIT_SCRIPT" ]]; then
    log "Script is executable"
  else
    warn "Script is not executable - should run: chmod +x $INIT_SCRIPT"
  fi
else
  error "init_sync_watch.sh script NOT FOUND"
fi

header "SUMMARY"
log "Verification completed. Check the output above for any issues."
echo "If you need to fix symlinks, run: bash $DATA_DIR/init_sync_watch.sh"
echo "If background processes are running, you can kill them with: pkill -f init_sync_watch.sh" 