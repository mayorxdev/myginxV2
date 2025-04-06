import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAuth } from "@/services/auth";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify authentication
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Only allow GET method for this endpoint
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Check symlinks manually
    const details: string[] = [];
    let allValid = true;

    // Check if .evilginx directory exists in workspace
    const workspaceDir = path.join(process.cwd(), "../../..");
    const evilginxDir = path.join(workspaceDir, ".evilginx");

    if (!fs.existsSync(evilginxDir)) {
      details.push(`Error: .evilginx directory not found at ${evilginxDir}`);
      allValid = false;
    } else {
      details.push(`✓ .evilginx directory exists at ${evilginxDir}`);

      // Check if the panel/data files are symlinks pointing to .evilginx files
      const dataDir = path.join(process.cwd(), "data");

      // Check config.json
      const localConfigPath = path.join(dataDir, "config.json");
      const sourceConfigPath = path.join(evilginxDir, "config.json");

      if (fs.existsSync(localConfigPath)) {
        if (fs.lstatSync(localConfigPath).isSymbolicLink()) {
          const target = fs.readlinkSync(localConfigPath);
          if (target === "../../../.evilginx/config.json") {
            details.push(
              `✓ config.json is properly symlinked to ${sourceConfigPath}`
            );
          } else {
            details.push(
              `✗ config.json symlink points to ${target} instead of ../../../.evilginx/config.json`
            );
            allValid = false;
          }
        } else {
          details.push(`✗ config.json exists but is not a symlink`);
          allValid = false;
        }
      } else {
        details.push(`✗ config.json does not exist in panel/data`);
        allValid = false;
      }

      // Check blacklist.txt
      const localBlacklistPath = path.join(dataDir, "blacklist.txt");
      const sourceBlacklistPath = path.join(evilginxDir, "blacklist.txt");

      if (fs.existsSync(localBlacklistPath)) {
        if (fs.lstatSync(localBlacklistPath).isSymbolicLink()) {
          const target = fs.readlinkSync(localBlacklistPath);
          if (target === "../../../.evilginx/blacklist.txt") {
            details.push(
              `✓ blacklist.txt is properly symlinked to ${sourceBlacklistPath}`
            );
          } else {
            details.push(
              `✗ blacklist.txt symlink points to ${target} instead of ../../../.evilginx/blacklist.txt`
            );
            allValid = false;
          }
        } else {
          details.push(`✗ blacklist.txt exists but is not a symlink`);
          allValid = false;
        }
      } else {
        details.push(`✗ blacklist.txt does not exist in panel/data`);
        allValid = false;
      }

      // Check data.db
      const localDataDbPath = path.join(dataDir, "data.db");
      const sourceDataDbPath = path.join(evilginxDir, "data.db");

      if (fs.existsSync(localDataDbPath)) {
        if (fs.lstatSync(localDataDbPath).isSymbolicLink()) {
          const target = fs.readlinkSync(localDataDbPath);
          if (target === "../../../.evilginx/data.db") {
            details.push(
              `✓ data.db is properly symlinked to ${sourceDataDbPath}`
            );
          } else {
            details.push(
              `✗ data.db symlink points to ${target} instead of ../../../.evilginx/data.db`
            );
            allValid = false;
          }
        } else {
          details.push(`✗ data.db exists but is not a symlink`);
          allValid = false;
        }
      } else {
        details.push(`✗ data.db does not exist in panel/data`);
        allValid = false;
      }
    }

    // Run the sync script to fix any issues
    if (!allValid) {
      details.push("Attempting to repair symlinks...");
      try {
        const syncScriptPath = path.join(
          process.cwd(),
          "data",
          "init_sync_watch.sh"
        );
        if (fs.existsSync(syncScriptPath)) {
          spawnSync("bash", [syncScriptPath, "sync-now"]);
          details.push("Repair completed. Refresh to check the status again.");
        } else {
          details.push(
            "Error: init_sync_watch.sh script not found for repair."
          );
        }
      } catch (repairError) {
        details.push(
          `Error during repair: ${
            repairError instanceof Error
              ? repairError.message
              : String(repairError)
          }`
        );
      }
    }

    return res.status(200).json({
      message: allValid
        ? "All symlinks are properly configured"
        : "Some symlinks are not properly configured",
      valid: allValid,
      details: details,
    });
  } catch (error) {
    console.error("Error checking symlinks:", error);
    return res.status(500).json({
      message: "Error checking symlinks",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
