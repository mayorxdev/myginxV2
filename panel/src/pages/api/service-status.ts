import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check if tmux session exists
    const tmuxCheck = await execAsync(
      "tmux ls 2>/dev/null || echo 'No tmux sessions'"
    );
    const sessionExists = tmuxCheck.stdout.includes("ginx-0");

    console.log("Checking tmux sessions:", tmuxCheck.stdout);
    console.log("ginx-0 session exists:", sessionExists);

    if (!sessionExists) {
      console.log("No ginx-0 tmux session found");
      return res
        .status(200)
        .json({ running: false, error: "Tmux session not found" });
    }

    // Capture the current prompt in the tmux session
    const capturePromptCmd = `tmux capture-pane -t ginx-0 -p | grep -E '(:$|#$)' | tail -1`;
    const { stdout: promptOutput } = await execAsync(capturePromptCmd);

    console.log("Prompt output:", promptOutput);
    console.log("Prompt ends with ':':", promptOutput.trim().endsWith(":"));
    console.log("Prompt ends with '#':", promptOutput.trim().endsWith("#"));

    // Check if the prompt contains a colon (indicating evilginx is running)
    // If it ends with : it's running, if it ends with # (bash prompt) it's not running
    const isRunning = promptOutput.trim().endsWith(":");

    console.log("Evilginx is running:", isRunning);

    return res.status(200).json({
      running: isRunning,
      prompt: promptOutput.trim(),
      session: "ginx-0",
    });
  } catch (error) {
    console.error("Error checking service status:", error);
    return res.status(500).json({
      error: "Failed to check service status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
