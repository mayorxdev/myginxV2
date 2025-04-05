#!/bin/bash

HOME_DIR=$HOME
EVILGINX_DIR="$HOME_DIR/.evilginx"
SOURCE_DIR="/Users/newuser/Desktop/Update On Myginx/.evilginx"
PANEL_DIR="/Users/newuser/Desktop/Update On Myginx/myginx/panel"
DATA_DIR="$PANEL_DIR/data"
CURRENT_USER="newuser"
GROUP="staff"

# Function to sync a file based on which is newer
sync_newest_file() {
  local file1="$1"
  local file2="$2"
  
  if [ ! -f "$file1" ] && [ ! -f "$file2" ]; then
    return
  elif [ ! -f "$file1" ]; then
    sudo cp "$file2" "$file1"
    sudo chmod 644 "$file1"
    sudo chown $CURRENT_USER:$GROUP "$file1"
  elif [ ! -f "$file2" ]; then
    sudo cp "$file1" "$file2"
    sudo chmod 644 "$file2"
    sudo chown $CURRENT_USER:$GROUP "$file2"
  else
    # Both files exist, compare timestamps
    file1_time=$(stat -f "%m" "$file1")
    file2_time=$(stat -f "%m" "$file2")
    
    if [ "$file1_time" -gt "$file2_time" ]; then
      sudo cp "$file1" "$file2"
      sudo chmod 644 "$file2"
      sudo chown $CURRENT_USER:$GROUP "$file2"
    elif [ "$file2_time" -gt "$file1_time" ]; then
      sudo cp "$file2" "$file1"
      sudo chmod 644 "$file1"
      sudo chown $CURRENT_USER:$GROUP "$file1"
    fi
  fi
}

# Sync data.db
sync_newest_file "$SOURCE_DIR/data.db" "$DATA_DIR/data.db"

# Sync config.json
sync_newest_file "$SOURCE_DIR/config.json" "$DATA_DIR/config.json"

# Sync blacklist.txt
sync_newest_file "$SOURCE_DIR/blacklist.txt" "$DATA_DIR/blacklist.txt"

# Check if Evilginx needs to be restarted
RESTART_FLAG="/tmp/evilginx_needs_restart"
if [ -f "$RESTART_FLAG" ]; then
  # Try to restart Evilginx via the API first
  curl -s -X POST http://localhost:3000/api/restart-evilginx || {
    # If API call fails, try to restart using tmux
    tmux_sessions=$(tmux ls 2>/dev/null || echo "")
    if [[ "$tmux_sessions" == *"ginx"* ]]; then
      tmux send-keys -t ginx "q" Enter
      sleep 2
      tmux send-keys -t ginx "./evilginx3 -feed -g ../gophish/gophish.db" Enter
    fi
  }
  
  # Remove the restart flag
  rm "$RESTART_FLAG"
fi
