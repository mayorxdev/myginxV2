import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";

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

    // Get detailed information about tmux sessions
    const { stdout: tmuxOutput } = await execAsync(
      "tmux ls 2>/dev/null || echo 'No tmux sessions'"
    );
    console.log("Current tmux sessions:", tmuxOutput);

    // Use the specific session name "ginx-0" as provided by the user
    const ginxSession = "ginx-0";

    if (tmuxOutput.includes(ginxSession)) {
      console.log(`Using ginx session: ${ginxSession}`);

      try {
        // Send the q command to the specific session
        await execAsync(`tmux send-keys -t "${ginxSession}" q Enter`);
        console.log("Sent quit command");

        // Wait for evilginx to quit completely
        await sleep(2000);
        console.log("Waited for evilginx to quit");

        // Send the restart command
        await execAsync(
          `tmux send-keys -t "${ginxSession}" "./evilginx3 -feed -g ../gophish/gophish.db" Enter`
        );
        console.log("Sent restart command");

        // Additional debug - list tmux sessions after command
        const { stdout: afterTmux } = await execAsync(
          "tmux ls 2>/dev/null || echo 'No tmux sessions'"
        );
        console.log("Tmux sessions after command:", afterTmux);

        return res.status(200).json({
          message: "Evilginx restarted successfully",
          debug: {
            tmuxBefore: tmuxOutput,
            tmuxAfter: afterTmux,
            sessionUsed: ginxSession,
          },
        });
      } catch (cmdError) {
        console.error("Error sending tmux command:", cmdError);
        return res.status(500).json({
          error: "Failed to send tmux command",
          details:
            cmdError instanceof Error ? cmdError.message : "Unknown error",
          sessionName: ginxSession,
        });
      }
    } else {
      console.log(`Session ${ginxSession} not found`);
      return res.status(404).json({
        message: `No tmux session named ${ginxSession} found`,
        availableSessions: tmuxOutput,
      });
    }
  } catch (error) {
    console.error("Error in restart-evilginx handler:", error);
    return res.status(500).json({
      error: "Failed to process request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
