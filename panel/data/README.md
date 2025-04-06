# Panel Data Directory

This directory contains important scripts and data files for the panel.

## Important Files

- `init_sync_watch.sh` - Creates symlinks to .evilginx files but does not create the files themselves
- `verify_integrity.sh` - Verifies that all required files exist and creates backups if needed
- `setup_permissions.sh` - Sets proper permissions on files
- `initial_setup.sh` - Sets up the .evilginx directory for first-time users (run only once)
- `protect_evilginx.sh` - Protects against accidental deletion of the .evilginx directory

## Protection System

The protection system consists of several safeguards to ensure your .evilginx data is never lost:

1. **Active Monitoring**: The `protect_evilginx.sh` script creates backups of your .evilginx directory and monitors it for accidental deletion. If the directory is deleted during operation, it will be automatically restored.

2. **Safe Startup**: The `start-safe.sh` script in the panel directory combines verification, symlink setup, and protection to ensure a safe panel startup.

3. **Backup Creation**: The system automatically creates timestamped backups of your configuration before each panel start.

## File Synchronization Behavior

**IMPORTANT**: The panel will **never** create or modify files in the `.evilginx` directory during normal operation. It only creates symlinks that point to existing files.

## Setup Instructions

### First-time Setup

If you're setting up for the first time:

1. Run the initial setup script:
   ```bash
   cd /path/to/myginxV2/panel/data
   ./initial_setup.sh
   ```

2. Start the panel with protection enabled:
   ```bash
   cd /path/to/myginxV2/panel
   ./start-safe.sh
   ```

### Existing Installation

If you already have an existing .evilginx directory:

1. Start the panel with protection enabled:
   ```bash
   cd /path/to/myginxV2/panel
   ./start-safe.sh
   ```

## Troubleshooting

If the panel wipes your configuration files on startup:

1. **Check if directory protection is running**: Make sure `protect_evilginx.sh` is being executed before starting the panel
2. **Use the safe startup script**: Always use `./start-safe.sh` instead of `npm run dev` directly
3. **Check your backups**: Look in `.evilginx_backups` directory for recent backups if files were lost

## Required Files

The following files must exist in the `.evilginx` directory:
- `blacklist.txt`
- `config.json`
- `data.db`

If these files don't exist, use the `initial_setup.sh` script to create them. 