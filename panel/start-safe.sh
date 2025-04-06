#!/bin/bash

# Safe startup script for the panel
# This script verifies the integrity of .evilginx files, creates backups,
# and ensures proper symlinks before starting the panel

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATA_DIR="$SCRIPT_DIR/data"
VERIFY_SCRIPT="$DATA_DIR/verify_integrity.sh"
SYNC_SCRIPT="$DATA_DIR/init_sync_watch.sh"
PROTECT_SCRIPT="$DATA_DIR/protect_evilginx.sh"

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
echo "1. Activate protection against accidental deletion"
echo "2. Verify the integrity of .evilginx files and create backups"
echo "3. Ensure symlinks are correctly set up"
echo "4. Start the panel with npm run dev"
echo ""

# Step 0: Run protection script to back up and monitor .evilginx directory
echo -e "${GREEN}Step 0: Activating directory protection...${NC}"
if [ -f "$PROTECT_SCRIPT" ]; then
    "$PROTECT_SCRIPT" &
    PROTECT_PID=$!
    echo -e "${GREEN}✓ Protection active - .evilginx directory is being monitored and backed up${NC}"
else
    echo -e "${RED}✗ Protection script not found at: $PROTECT_SCRIPT${NC}"
    echo -e "${RED}  .evilginx directory will not be protected against accidental deletion${NC}"
fi

# Step 1: Verify integrity of .evilginx files
echo -e "${GREEN}Step 1: Verifying .evilginx files and creating backups...${NC}"
if [ -f "$VERIFY_SCRIPT" ]; then
    bash "$VERIFY_SCRIPT"
    VERIFY_EXIT_CODE=$?
    
    if [ $VERIFY_EXIT_CODE -ne 0 ]; then
        echo -e "${RED}✗ Verification failed with exit code: $VERIFY_EXIT_CODE${NC}"
        echo -e "${RED}  You may need to run the initial_setup.sh script if this is your first time.${NC}"
        echo -e "${YELLOW}  Do you want to continue anyway? (y/n)${NC}"
        read -r CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            echo -e "${RED}Exiting at user request.${NC}"
            # Kill protection script if running
            if [ -n "$PROTECT_PID" ]; then
                kill $PROTECT_PID 2>/dev/null || true
            fi
            exit 1
        fi
    else
        echo -e "${GREEN}✓ Verification completed successfully${NC}"
    fi
else
    echo -e "${RED}✗ Verification script not found: $VERIFY_SCRIPT${NC}"
    echo -e "${YELLOW}  Continuing without verification...${NC}"
fi

echo ""

# Step 2: Ensure symlinks are correctly set up
echo -e "${GREEN}Step 2: Ensuring symlinks are correctly set up...${NC}"
if [ -f "$SYNC_SCRIPT" ]; then
    # Run in non-interactive mode with yes
    yes | bash "$SYNC_SCRIPT"
    SYNC_EXIT_CODE=$?
    
    if [ $SYNC_EXIT_CODE -ne 0 ]; then
        echo -e "${RED}✗ Symlink setup failed with exit code: $SYNC_EXIT_CODE${NC}"
        echo -e "${YELLOW}  Do you want to continue anyway? (y/n)${NC}"
        read -r CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            echo -e "${RED}Exiting at user request.${NC}"
            # Kill protection script if running
            if [ -n "$PROTECT_PID" ]; then
                kill $PROTECT_PID 2>/dev/null || true
            fi
            exit 1
        fi
    else
        echo -e "${GREEN}✓ Symlinks set up successfully${NC}"
    fi
else
    echo -e "${RED}✗ Symlink script not found: $SYNC_SCRIPT${NC}"
    echo -e "${RED}  The panel may not function correctly without proper symlinks.${NC}"
    echo -e "${YELLOW}  Do you want to continue anyway? (y/n)${NC}"
    read -r CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        echo -e "${RED}Exiting at user request.${NC}"
        # Kill protection script if running
        if [ -n "$PROTECT_PID" ]; then
            kill $PROTECT_PID 2>/dev/null || true
        fi
        exit 1
    fi
fi

echo ""

# Step 3: Start the panel
echo -e "${GREEN}Step 3: Starting the panel...${NC}"
echo "Starting panel with npm run dev"
echo "Press Ctrl+C to stop the panel."
echo ""
echo -e "${GREEN}=================================================================${NC}"

# Change to the panel directory and start
cd "$SCRIPT_DIR"
npm run dev

# When npm run dev terminates, clean up
# Kill protection script if running
if [ -n "$PROTECT_PID" ]; then
    echo -e "${YELLOW}Shutting down protection service...${NC}"
    kill $PROTECT_PID 2>/dev/null || true
    echo -e "${GREEN}✓ Protection service terminated${NC}"
fi

echo -e "${GREEN}Panel has been stopped.${NC}" 