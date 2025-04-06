/**
 * This file contains configurable paths for the application
 * Edit these values to match your deployment environment
 */

// Evilginx binary location - adjust based on your installation
export const EVILGINX_PATHS = [
  "/root/myginxV2/evilginx3", // Primary location
  "/root/myginx/evilginx3", // Secondary location
  "/opt/myginx/evilginx3", // Alternative location
];

// Database paths
export const DATABASE_PATHS = {
  GOPHISH_DB: "../gophish/gophish.db", // Path relative to evilginx binary
};

// Commands
export const EVILGINX_COMMAND = "./evilginx3 -feed -g ../gophish/gophish.db";
