# Panel Data Directory

This directory contains important files for the Myginx panel configuration and functionality.

## Important Files

- `init_sync_watch.sh` - Sets up symlinks to existing files in the `.evilginx` directory
- `create_symlinks_only.sh` - Alternative script that only creates symlinks without any other operations
- `setup_permissions.sh` - Ensures correct permissions but NEVER creates files in `.evilginx`
- `initial_setup.sh` - First-time setup script that creates default files in `.evilginx` (run ONCE only)
- `auth.db` - Local SQLite database for panel authentication (created by the panel)

## File Synchronization Behavior

### IMPORTANT: The panel NEVER creates files in the `.evilginx` directory during normal operation

The synchronization scripts (`init_sync_watch.sh` and `create_symlinks_only.sh`) will:

1. Check if required files exist in the `.evilginx` directory
2. Create symlinks in the `panel/data` directory pointing to existing files in `.evilginx`
3. NEVER create any default files in the `.evilginx` directory

## First-Time Setup vs. Normal Operation

- **First-Time Setup**: If you're setting up for the first time, use `initial_setup.sh` to create default files in `.evilginx` directory.
- **Normal Operation**: After initial setup, the panel will NEVER modify your `.evilginx` files on startup. This ensures your configuration persists.

## Required Files

The following files must exist in the `.evilginx` directory before running the panel:

- `config.json` - Evilginx configuration file
- `blacklist.txt` - Blacklist configuration
- `data.db` - Evilginx database file

## Setup Instructions

### For First-Time Setup:

1. Run the initial setup script once to create necessary files:
   ```
   cd panel/data
   ./initial_setup.sh
   ```

2. Start the panel application:
   ```
   cd panel
   npm run dev
   ```

### For Existing Installation:

1. Ensure the `.evilginx` directory exists with all required files
2. Run one of the sync scripts to create the necessary symlinks:
   ```
   ./create_symlinks_only.sh
   ```
   or
   ```
   ./init_sync_watch.sh
   ```
3. Start the panel application

## Troubleshooting

If the panel wipes your configuration files on startup:

1. Make sure you haven't modified `setup_permissions.sh` or setup scripts to create files
2. Verify your startup process isn't running `initial_setup.sh` accidentally
3. Check that all symlinks in the `panel/data` directory are pointing to the correct files

Remember: The panel will never create default files in the `.evilginx` directory during normal operation. If your files are being overwritten, something in your setup is incorrect. 