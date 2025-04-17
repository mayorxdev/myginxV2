import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);
const fsPromises = fs.promises;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Create a unique temp file name for this request
  const tempFile = `/tmp/evilginx_url_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 10)}.txt`;

  try {
    // Get the lure index from the query parameters
    const { lureIndex } = req.query;

    // Validate lure index
    if (!lureIndex || isNaN(Number(lureIndex))) {
      return res
        .status(400)
        .json({ error: "Invalid lure index. Please provide a valid number." });
    }

    // Check if the tmux session exists
    const { stdout: tmuxCheck } = await execAsync(
      "tmux ls 2>/dev/null || echo 'No tmux sessions'"
    );
    const sessionExists = tmuxCheck.includes("ginx-0");

    if (!sessionExists) {
      return res.status(500).json({
        error:
          "Evilginx tmux session (ginx-0) not found. Please start evilginx first.",
      });
    }

    // First, clear the prompt by sending an Enter key
    await execAsync(`tmux send-keys -t ginx-0 C-c`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await execAsync(`tmux send-keys -t ginx-0 C-m`);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Run the lures get-url command inside the tmux session and redirect output to a temp file
    await execAsync(
      `tmux send-keys -t ginx-0 "lures get-url ${lureIndex} > ${tempFile} 2>&1" C-m`
    );

    // Give evilginx time to execute the command and write to the file
    // Start with a small delay and increase if needed
    let attempts = 0;
    let fileContent = "";

    while (attempts < 5) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        // Check if the file exists and has content
        if (fs.existsSync(tempFile)) {
          fileContent = await fsPromises.readFile(tempFile, "utf8");
          if (fileContent.trim()) {
            break; // We have content, exit the loop
          }
        }
      } catch (_err) {
        // Ignore file read errors, will retry
      }

      attempts++;
    }

    // If the file doesn't exist or is empty after all attempts, return an error
    if (!fileContent.trim()) {
      return res.status(500).json({
        error: "Failed to get output from evilginx command",
      });
    }

    try {
      // Clean up the temp file
      await fsPromises.unlink(tempFile);
    } catch (_err) {
      // Ignore cleanup errors
    }

    // Extract the URL from the output
    const lines = fileContent.trim().split("\n");

    // Look for a line that starts with http
    let url = "";
    for (const line of lines) {
      if (line.trim().startsWith("http")) {
        url = line.trim();
        break;
      }
    }

    // If we didn't find a URL, use the last line as fallback
    if (!url && lines.length > 0) {
      url = lines[lines.length - 1].trim();
    }

    if (!url.startsWith("http")) {
      return res.status(500).json({
        error: "Failed to get valid URL from evilginx",
        output: fileContent,
      });
    }

    return res.status(200).json({ url });
  } catch (error) {
    // Always try to clean up the temp file in case of error
    try {
      if (fs.existsSync(tempFile)) {
        await fsPromises.unlink(tempFile);
      }
    } catch (_err) {
      // Ignore cleanup errors
    }

    console.error("Error executing evilginx command:", error);
    return res.status(500).json({
      error: "Failed to execute evilginx command",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
