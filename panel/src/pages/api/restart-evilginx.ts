import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { EVILGINX_PATHS } from "@/config/paths";

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

    // Define possible evilginx paths - use the configured paths plus a relative path
    const possiblePaths = [
      ...EVILGINX_PATHS,
      path.resolve(process.cwd(), "../../evilginx3"),
    ];

    // Try to find the correct path
    let evilginxPath = "";
    for (const potentialPath of possiblePaths) {
      console.log("Checking path:", potentialPath);
      if (fs.existsSync(potentialPath)) {
        evilginxPath = potentialPath;
        console.log("Found evilginx at:", evilginxPath);
        break;
      }
    }

    // If no path is found, fallback to the primary path but with a better error message
    if (!evilginxPath) {
      console.log("No valid evilginx path found, using default");
      evilginxPath = EVILGINX_PATHS[0];
    }

    console.log("Using evilginx path:", evilginxPath);

    // Verify the directory and executable exist
    if (!fs.existsSync(evilginxPath)) {
      throw new Error(
        `Evilginx directory not found at ${evilginxPath}. Please check your installation or update the EVILGINX_PATHS in the config file.`
      );
    }

    const executablePath = path.join(evilginxPath, "evilginx3");
    if (!fs.existsSync(executablePath)) {
      throw new Error(
        `Evilginx executable not found at ${executablePath}. Please check installation.`
      );
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
      // Simply run the evilginx command without changing directory
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
