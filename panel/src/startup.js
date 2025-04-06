import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// File paths
const dataDir = path.join(process.cwd(), "data");
const syncScriptPath = path.join(dataDir, "init_sync_watch.sh");

// Function to run the sync script once, not as a background process
export function startSyncProcess() {
  console.log("Setting up file synchronization...");

  // Check if script exists
  if (!fs.existsSync(syncScriptPath)) {
    console.error(`Sync script not found at: ${syncScriptPath}`);
    return false;
  }

  // Make script executable if needed
  try {
    fs.chmodSync(syncScriptPath, 0o755);
  } catch (error) {
    console.error("Error making script executable:", error);
    // Continue anyway - it might already be executable
  }

  // Run the script synchronously (blocks until complete)
  try {
    console.log("Creating symlinks to .evilginx files...");
    execSync(`bash "${syncScriptPath}"`, {
      stdio: ["ignore", "ignore", "ignore"],
    });
    console.log("File sync completed successfully.");
    return true;
  } catch (error) {
    console.error("Error running sync script:", error);
    return false;
  }
}
