import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// File paths
const dataDir = path.join(process.cwd(), "data");
const syncScriptPath = path.join(dataDir, "init_sync_watch.sh");
const verifyScriptPath = path.join(dataDir, "verify_integrity.sh");
const initialSetupScriptPath = path.join(dataDir, "initial_setup.sh");

// Function to check if symlinks are already set up correctly
function areSymlinksValid() {
  try {
    // Check if the key files exist as symlinks
    const filesToCheck = ["config.json", "blacklist.txt", "data.db"];

    for (const file of filesToCheck) {
      const filePath = path.join(dataDir, file);

      // If file doesn't exist, symlinks are not valid
      if (!fs.existsSync(filePath)) {
        console.log(`File ${file} doesn't exist, symlinks not set up.`);
        return false;
      }

      // Check if it's a symlink
      const stats = fs.lstatSync(filePath);
      if (!stats.isSymbolicLink()) {
        console.log(`File ${file} exists but is not a symlink, setup needed.`);
        return false;
      }

      // Check if symlink is readable
      try {
        const content = fs.readFileSync(filePath, {
          encoding: "utf8",
          flag: "r",
        });
        if (content === null) {
          console.log(`Symlink for ${file} exists but is not readable.`);
          return false;
        }
      } catch (error) {
        console.log(`Error reading symlink for ${file}: ${error.message}`);
        return false;
      }
    }

    console.log("All symlinks appear to be valid and readable.");
    return true;
  } catch (error) {
    console.error("Error checking symlinks:", error);
    return false;
  }
}

// Check if .evilginx directory and files exist
function checkEvilginxFiles() {
  const workspaceDir = path.resolve(process.cwd(), "../../..");
  const evilginxDir = path.join(workspaceDir, ".evilginx");
  const requiredFiles = ["config.json", "blacklist.txt", "data.db"];

  console.log("Checking .evilginx directory and files...");

  // Check if .evilginx directory exists
  if (!fs.existsSync(evilginxDir)) {
    console.error(
      `ERROR: .evilginx directory does not exist at ${evilginxDir}`
    );
    console.error(
      "===================================================================="
    );
    console.error("CRITICAL ERROR: The .evilginx directory is missing!");
    console.error(
      "This directory is required and must contain specific files."
    );
    console.error("");
    console.error("If this is your first time running the panel:");
    console.error(`Run: bash ${initialSetupScriptPath}`);
    console.error("");
    console.error("For existing installations with data you want to preserve:");
    console.error("1. Create the .evilginx directory manually");
    console.error(
      "2. Ensure it contains: config.json, blacklist.txt, and data.db"
    );
    console.error(
      "3. Run the symlink script to connect these files to the panel"
    );
    console.error(
      "===================================================================="
    );
    return false;
  }

  // Check required files
  let missingFiles = [];
  for (const file of requiredFiles) {
    const filePath = path.join(evilginxDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(
        `ERROR: Required file ${file} does not exist in .evilginx directory`
      );
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.error(
      "===================================================================="
    );
    console.error(
      `CRITICAL ERROR: Missing required files in .evilginx directory:`
    );
    missingFiles.forEach((file) => console.error(`- ${file}`));
    console.error("");
    console.error("If this is your first time running the panel:");
    console.error(`Run: bash ${initialSetupScriptPath}`);
    console.error("");
    console.error("For existing installations with data you want to preserve:");
    console.error("Run the verification script to diagnose issues:");
    console.error(`bash ${verifyScriptPath}`);
    console.error(
      "===================================================================="
    );
    return false;
  }

  console.log("✅ All required files exist in .evilginx directory");
  return true;
}

// Function to run the sync script once, not as a background process
export function startSyncProcess() {
  console.log("Checking file synchronization...");

  // Important warning about functionality
  console.log(
    "================================================================="
  );
  console.log(
    "IMPORTANT: This process will NEVER create any files in .evilginx directory."
  );
  console.log(
    "It only creates symlinks in panel/data pointing to EXISTING files in .evilginx."
  );
  console.log(
    "================================================================="
  );

  // Check if script exists
  if (!fs.existsSync(syncScriptPath)) {
    console.error(`Sync script not found at: ${syncScriptPath}`);
    return false;
  }

  // First check if .evilginx files exist
  if (!checkEvilginxFiles()) {
    console.error(
      "Cannot proceed with symlink creation - required files missing."
    );
    console.error(
      "Please ensure all required files exist in .evilginx directory first."
    );
    console.error("");
    console.error("Run the verification script to diagnose issues:");
    console.error(`bash ${verifyScriptPath}`);
    return false;
  }

  // Check if symlinks are already valid
  if (areSymlinksValid()) {
    console.log("Symlinks already set up correctly, skipping initialization.");
    return true;
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
    console.log(
      "WARNING: Creating symlinks to .evilginx files. This should only be done once for initial setup."
    );
    console.log(
      "The script will NOT create or modify any files in the .evilginx directory."
    );

    // Run in non-interactive mode with a "yes" to all prompts to avoid hanging
    execSync(`yes | bash "${syncScriptPath}"`, {
      stdio: ["ignore", "pipe", "pipe"], // Capture output for debugging
      maxBuffer: 1024 * 1024, // Increase buffer size
    });

    console.log("File sync completed successfully.");

    // Verify symlinks after running
    if (areSymlinksValid()) {
      console.log("Verified that symlinks are now correctly set up.");
      return true;
    } else {
      console.error(
        "Symlinks may not be set up correctly after running the script."
      );
      console.error("Run the verification script for diagnosis:");
      console.error(`bash ${verifyScriptPath}`);
      return false;
    }
  } catch (error) {
    console.error("Error running sync script:", error);
    console.error("Details:", error.stdout?.toString() || "No output");
    console.error("");
    console.error("Try running the verification script:");
    console.error(`bash ${verifyScriptPath}`);
    return false;
  }
}
