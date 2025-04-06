#!/bin/bash

# Script to create a minimal config.json with just enough structure to work with all endpoints
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../" && pwd)"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"
CONFIG_FILE="$EVILGINX_DIR/config.json"
CURRENT_USER=$(whoami)
GROUP=$(id -gn)

echo "Creating minimal compatible config.json file..."

# Create .evilginx directory if needed
if [ ! -d "$EVILGINX_DIR" ]; then
    mkdir -p "$EVILGINX_DIR"
    chmod 755 "$EVILGINX_DIR"
    chown $CURRENT_USER:$GROUP "$EVILGINX_DIR"
fi

# Create a minimal structure that will work with all endpoints
cat > "$CONFIG_FILE" << EOF
{
  "blacklist": {
    "mode": "unauth"
  },
  "general": {
    "domain": "",
    "ipv4": "",
    "external_ipv4": "",
    "bind_ipv4": "",
    "unauth_url": "",
    "https_port": 443,
    "dns_port": 53,
    "autocert": true,
    "telegram_bot_token": "",
    "telegram_chat_id": ""
  },
  "phishlets": {}
}
EOF

chmod 644 "$CONFIG_FILE"
chown $CURRENT_USER:$GROUP "$CONFIG_FILE"

echo "Created minimal config.json at $CONFIG_FILE"
echo "This minimal structure will prevent errors in the API endpoints."
echo "You can now restart the application." 