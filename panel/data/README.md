# Panel Data Directory

This directory contains important files for the Myginx panel configuration and functionality.

## Important Files

- `init_sync_watch.sh` - Sets up symlinks to existing files in the `.evilginx` directory
- `create_symlinks_only.sh` - Alternative script that only creates symlinks without any other operations
- `auth.db` - Local SQLite database for panel authentication (created by the panel)

## File Synchronization Behavior

### IMPORTANT: The panel NEVER creates files in the `.evilginx` directory

The synchronization scripts (`init_sync_watch.sh` and `create_symlinks_only.sh`) will:

1. Check if required files exist in the `.evilginx` directory
2. Create symlinks in the `panel/data` directory pointing to existing files in `.evilginx`
3. NEVER create any default files in the `.evilginx` directory

## Required Files

The following files must exist in the `.evilginx` directory before running the panel:

- `config.json` - Evilginx configuration file
- `blacklist.txt` - Blacklist configuration
- `data.db` - Evilginx database file

## Setup Instructions

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

If the panel cannot access configuration files:

1. Check that the `.evilginx` directory exists with the required files
2. Verify that the symlinks in the `panel/data` directory are pointing to the correct files
3. Run the `create_symlinks_only.sh` script to recreate the symlinks

Remember: The panel will never create default files in the `.evilginx` directory. These must be created manually or by the core Evilginx application. 