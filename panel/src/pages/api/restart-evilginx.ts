import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Starting evilginx restart process...");

    // Get the absolute path to the evilginx directory - updated for VPS
    const evilginxPath = "/root/myginx/evilginx3";
    console.log("Using evilginx path:", evilginxPath);

    // Verify the directory and executable exist
    if (!fs.existsSync(evilginxPath)) {
      throw new Error(`Evilginx directory not found at ${evilginxPath}`);
    }
    if (!fs.existsSync(path.join(evilginxPath, "evilginx3"))) {
      throw new Error("Evilginx executable not found");
    }

    // List current tmux sessions for debugging
    const tmuxLs = await execAsync("tmux ls || true");
    console.log("Current tmux sessions:", tmuxLs.stdout);

    // Check if ginx session exists, if not create it
    if (!tmuxLs.stdout.includes("ginx:")) {
      console.log("Creating new ginx session...");
      await execAsync(
        `cd ${evilginxPath} && tmux new-session -d -s ginx "./evilginx3 -feed -g ../gophish/gophish.db"`
      );
    } else {
      console.log("Sending quit command to existing ginx session...");

      // Just send 'q' and Enter
      await execAsync('tmux send-keys -t ginx "q" Enter');
      console.log("Sent quit command");

      // Wait for evilginx to quit
      await sleep(2000);
      console.log("Waited for quit");

      console.log("Restarting evilginx...");
      // Send the restart command at shell prompt
      await execAsync(
        'tmux send-keys -t ginx "./evilginx3 -feed -g ../gophish/gophish.db" Enter'
      );
      console.log("Sent restart command");
    }

    // Verify the session exists
    const verifyTmux = await execAsync("tmux ls || true");
    console.log("Tmux sessions after restart:", verifyTmux.stdout);

    if (!verifyTmux.stdout.includes("ginx")) {
      throw new Error("Failed to verify tmux session");
    }

    return res.status(200).json({
      message: "Evilginx restarted successfully",
      debug: {
        tmuxBefore: tmuxLs.stdout,
        tmuxAfter: verifyTmux.stdout,
      },
    });
  } catch (error) {
    console.error("Error restarting evilginx:", error);
    return res.status(500).json({
      error: "Failed to restart evilginx",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
