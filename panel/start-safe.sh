#!/bin/bash

# Safe startup script for the panel
# This script verifies the integrity of .evilginx files, creates backups,
# and ensures proper symlinks before starting the panel

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATA_DIR="$SCRIPT_DIR/data"
VERIFY_SCRIPT="$DATA_DIR/verify_integrity.sh"
SYNC_SCRIPT="$DATA_DIR/init_sync_watch.sh"

# Print colored output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=================================================================${NC}"
echo -e "${GREEN}               SAFE PANEL STARTUP SCRIPT                        ${NC}"
echo -e "${GREEN}=================================================================${NC}"
echo ""
echo -e "${BLUE}This script will:${NC}"
echo "1. Verify the integrity of .evilginx files and create backups"
echo "2. Ensure symlinks are correctly set up"
echo "3. Start the panel with npm run dev"
echo ""

# Step 1: Verify integrity of .evilginx files
echo -e "${YELLOW}Step 1: Verifying .evilginx files and creating backups...${NC}"
if [ -f "$VERIFY_SCRIPT" ]; then
    bash "$VERIFY_SCRIPT"
    VERIFY_EXIT_CODE=$?
    
    if [ $VERIFY_EXIT_CODE -ne 0 ]; then
        echo -e "${RED}Verification failed! Please fix the issues before continuing.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Verification script not found: $VERIFY_SCRIPT${NC}"
    echo "Continuing anyway, but this is not recommended."
fi

echo ""

# Step 2: Ensure symlinks are correctly set up
echo -e "${YELLOW}Step 2: Ensuring symlinks are correctly set up...${NC}"
if [ -f "$SYNC_SCRIPT" ]; then
    # Run in non-interactive mode with yes
    yes | bash "$SYNC_SCRIPT"
    SYNC_EXIT_CODE=$?
    
    if [ $SYNC_EXIT_CODE -ne 0 ]; then
        echo -e "${RED}Symlink setup failed! Please fix the issues before continuing.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Sync script not found: $SYNC_SCRIPT${NC}"
    echo "Cannot set up symlinks. The panel may not work correctly."
    exit 1
fi

echo ""

# Step 3: Start the panel
echo -e "${YELLOW}Step 3: Starting the panel...${NC}"
echo "Starting panel with npm run dev"
echo "Press Ctrl+C to stop the panel."
echo ""
echo -e "${GREEN}=================================================================${NC}"

# Change to the panel directory and start
cd "$SCRIPT_DIR"
npm run dev 