#!/bin/bash

# Script to fix empty or invalid config.json files
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
CONFIG_FILE="$EVILGINX_DIR/config.json"
BACKUP_FILE="$EVILGINX_DIR/config.json.backup.$(date +%Y%m%d%H%M%S)"
CURRENT_USER=$(whoami)
GROUP=$(id -gn)

echo "Fixing config.json file..."

# Check if config.json exists
if [ -f "$CONFIG_FILE" ]; then
    # Create a backup
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo "Created backup at $BACKUP_FILE"

    # Check if the file is empty
    if [ ! -s "$CONFIG_FILE" ]; then
        echo "Config file is empty. Creating new config structure..."
        CREATE_NEW=true
    else
        # Check if it's valid JSON
        if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
            echo "Config file contains invalid JSON. Creating new config structure..."
            CREATE_NEW=true
        else
            # Check if it has the required structure
            MISSING_STRUCTURE=false
            
            # Check if general section exists
            if ! jq -e '.general' "$CONFIG_FILE" >/dev/null 2>&1; then
                echo "Missing 'general' section in config. Will add it."
                MISSING_STRUCTURE=true
            fi
            
            # Check if blacklist section exists
            if ! jq -e '.blacklist' "$CONFIG_FILE" >/dev/null 2>&1; then
                echo "Missing 'blacklist' section in config. Will add it."
                MISSING_STRUCTURE=true
            fi
            
            # Check if lures section exists
            if ! jq -e '.lures' "$CONFIG_FILE" >/dev/null 2>&1; then
                echo "Missing 'lures' section in config. Will add it."
                MISSING_STRUCTURE=true
            fi
            
            if [ "$MISSING_STRUCTURE" = false ]; then
                echo "Config file appears to be valid. No changes needed."
                exit 0
            else
                echo "Adding missing structure while preserving existing data..."
                
                # Create a temporary merged config
                TMP_CONFIG=$(mktemp)
                
                # Start with existing config
                cat "$CONFIG_FILE" > "$TMP_CONFIG"
                
                # Add general section if missing
                if ! jq -e '.general' "$CONFIG_FILE" >/dev/null 2>&1; then
                    jq '. + {"general":{"domain":"","redirect_url":"","telegram_bot_token":"","telegram_chat_id":"","unauth_url":""}}' "$TMP_CONFIG" > "$TMP_CONFIG.new"
                    mv "$TMP_CONFIG.new" "$TMP_CONFIG"
                fi
                
                # Add blacklist section if missing
                if ! jq -e '.blacklist' "$CONFIG_FILE" >/dev/null 2>&1; then
                    jq '. + {"blacklist":{"mode":"off"}}' "$TMP_CONFIG" > "$TMP_CONFIG.new"
                    mv "$TMP_CONFIG.new" "$TMP_CONFIG"
                fi
                
                # Add lures section if missing
                if ! jq -e '.lures' "$CONFIG_FILE" >/dev/null 2>&1; then
                    jq '. + {"lures":[{"hostname":"","id":"","info":"","og_desc":"","og_image":"","og_title":"","og_url":"","path":"/","paused":0,"phishlet":"001","redirect_url":"","redirector":"","ua_filter":""}]}' "$TMP_CONFIG" > "$TMP_CONFIG.new"
                    mv "$TMP_CONFIG.new" "$TMP_CONFIG"
                fi
                
                # Format the JSON nicely
                jq '.' "$TMP_CONFIG" > "$CONFIG_FILE"
                
                # Clean up
                rm -f "$TMP_CONFIG"
            fi
        fi
    fi
else
    echo "Config file does not exist. Creating new one..."
    CREATE_NEW=true
fi

# Create new config.json if needed
if [ "$CREATE_NEW" = true ]; then
    # Create config.json with minimum required structure
    cat > "$CONFIG_FILE" << EOF
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
fi

# Set proper permissions
chmod 644 "$CONFIG_FILE"
chown $CURRENT_USER:$GROUP "$CONFIG_FILE"

echo "Config file has been fixed with the required structure."
echo "You can now restart the application." 