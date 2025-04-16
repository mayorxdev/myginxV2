import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import { EVILGINX_PATHS, EVILGINX_COMMAND } from "@/config/paths";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check current status
    const { stdout: statusOutput } = await execAsync(
      "tmux ls 2>/dev/null || echo 'No tmux sessions'"
    );
    const sessionExists = statusOutput.includes("ginx-0");

    if (!sessionExists) {
      // Create new tmux session and start evilginx
      try {
        // Find evilginx directory path
        const possiblePaths = [
          ...EVILGINX_PATHS,
          path.resolve(process.cwd(), "../../evilginx3"),
        ];

        let evilginxPath = "";
        for (const potentialPath of possiblePaths) {
          if (fs.existsSync(potentialPath)) {
            evilginxPath = potentialPath;
            break;
          }
        }

        if (!evilginxPath) {
          return res.status(500).json({
            error: "Evilginx directory not found. Check configuration.",
          });
        }

        // Create new tmux session with evilginx
        console.log(
          `Creating new tmux session with command: ${EVILGINX_COMMAND}`
        );
        await execAsync(
          `tmux new-session -d -s ginx-0 "cd ${evilginxPath} && ${EVILGINX_COMMAND}"`
        );
        console.log("New tmux session created successfully");

        return res.status(200).json({
          success: true,
          action: "started",
          message: "Evilginx service started successfully",
        });
      } catch (startError) {
        console.error("Error starting evilginx:", startError);
        return res.status(500).json({
          error: "Failed to start evilginx service",
          details:
            startError instanceof Error ? startError.message : "Unknown error",
        });
      }
    } else {
      // Check if evilginx is running in the session
      const capturePromptCmd = `tmux capture-pane -t ginx-0 -p | grep -E '(:$|#$)' | tail -1`;
      const { stdout: promptOutput } = await execAsync(capturePromptCmd);
      const isRunning = promptOutput.trim().endsWith(":");

      if (isRunning) {
        // Send 'q' to quit evilginx
        console.log("Evilginx is running. Sending 'q' command to stop it...");
        await execAsync('tmux send-keys -t ginx-0 "q" Enter');
        console.log("Sent 'q' command to stop evilginx");

        return res.status(200).json({
          success: true,
          action: "stopped",
          message: "Evilginx service stopped successfully",
        });
      } else {
        // Evilginx is not running, we need to start it
        console.log("Evilginx is not running, preparing to start it...");

        // Check if tmux session exists
        const tmuxSessionCheck = await execAsync(
          "tmux ls 2>/dev/null || echo 'No tmux sessions'"
        );
        const sessionExists = tmuxSessionCheck.stdout.includes("ginx-0");

        if (!sessionExists) {
          // Create a new tmux session
          console.log("Creating new tmux session 'ginx-0'...");
          await execAsync(
            `tmux new-session -d -s ginx-0 "${EVILGINX_COMMAND}" || echo 'Failed to create session'`
          );
          console.log("New tmux session created with evilginx command");
        } else {
          // Start evilginx in the existing session
          console.log("Using existing tmux session 'ginx-0'");
          console.log(`Starting evilginx with command: ${EVILGINX_COMMAND}`);
          await execAsync(
            `tmux send-keys -t ginx-0 "${EVILGINX_COMMAND}" C-m || echo 'Failed to send command'`
          );
          console.log("Start command sent successfully");
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error toggling service:", error);
    return res.status(500).json({
      error: "Failed to toggle service",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
