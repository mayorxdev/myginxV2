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

    # Check if the file is empty or invalid JSON
    if [ ! -s "$CONFIG_FILE" ] || ! jq empty "$CONFIG_FILE" 2>/dev/null; then
        echo "Config file is empty or invalid. Creating new config structure..."
    else
        # Check if it has the required structure
        if ! jq -e '.general' "$CONFIG_FILE" >/dev/null 2>&1; then
            echo "Config file is missing required structure. Creating new config structure..."
        else
            echo "Config file appears to be valid. No changes needed."
            exit 0
        fi
    fi
else
    echo "Config file does not exist. Creating new one..."
fi

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

# Set proper permissions
chmod 644 "$CONFIG_FILE"
chown $CURRENT_USER:$GROUP "$CONFIG_FILE"

echo "Config file has been fixed with the required structure."
echo "You can now restart the application." 