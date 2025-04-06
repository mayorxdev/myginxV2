import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAuth } from "@/services/auth";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify authentication
  const isAuthenticated = await verifyAuth(req);
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Only allow POST method for this endpoint
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Get the path to the sync script
    const dataDir = path.join(process.cwd(), "data");
    const syncScriptPath = path.join(dataDir, "init_sync_watch.sh");

    // Check if script exists
    if (!fs.existsSync(syncScriptPath)) {
      return res.status(500).json({
        message: "Sync script not found",
        path: syncScriptPath,
      });
    }

    // Make script executable if needed
    try {
      fs.chmodSync(syncScriptPath, 0o755);
    } catch (error) {
      console.error("Error making script executable:", error);
      // Continue anyway - it might already be executable
    }

    // Run the sync script with a specific action for immediate sync
    const syncProcess = spawn("bash", [syncScriptPath, "sync-now"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";

    syncProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    syncProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    await new Promise<void>((resolve) => {
      syncProcess.on("close", () => {
        resolve();
      });
    });

    if (errorOutput) {
      console.error("Error syncing files:", errorOutput);
      return res.status(500).json({
        message: "Error syncing files",
        error: errorOutput,
      });
    }

    return res.status(200).json({
      message: "Files synchronized successfully",
      details: output,
    });
  } catch (error) {
    console.error("Error handling sync request:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
