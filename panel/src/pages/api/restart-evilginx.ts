import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Starting evilginx quit process...");

    // List current tmux sessions for debugging
    const tmuxLs = await execAsync("tmux ls || true");
    console.log("Current tmux sessions:", tmuxLs.stdout);

    // Check if ginx session exists
    if (tmuxLs.stdout.includes("ginx:")) {
      console.log("Sending quit command to existing ginx session...");
      // Send 'q' to quit evilginx
      await execAsync('tmux send-keys -t ginx "q" Enter');
      console.log("Sent quit command");
    } else {
      console.log("No ginx session found to quit");
    }

    return res.status(200).json({
      message: "Quit command sent to evilginx",
      debug: {
        tmuxBefore: tmuxLs.stdout,
      },
    });
  } catch (error) {
    console.error("Error sending quit command to evilginx:", error);
    return res.status(500).json({
      error: "Failed to send quit command",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
