#!/bin/bash

# Script that preserves existing config.json content without imposing any structure
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
CONFIG_FILE="$EVILGINX_DIR/config.json"
CURRENT_USER=$(whoami)
GROUP=$(id -gn)

echo "Checking config.json file..."

# Only create if it doesn't exist
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Config file does not exist. Creating minimal config..."
    
    # Create empty config.json
    echo "{}" > "$CONFIG_FILE"
    chmod 644 "$CONFIG_FILE"
    chown $CURRENT_USER:$GROUP "$CONFIG_FILE"
    
    echo "Created minimal config.json file."
else
    echo "Config file exists. Keeping original content without modification."
fi

echo "Config check complete. No changes made to existing configuration." 