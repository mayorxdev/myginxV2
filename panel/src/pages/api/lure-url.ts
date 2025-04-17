import { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the lure index from the query parameters
    const { lureIndex } = req.query;

    // Validate lure index
    if (!lureIndex || isNaN(Number(lureIndex))) {
      return res
        .status(400)
        .json({ error: "Invalid lure index. Please provide a valid number." });
    }

    // Get path to evilginx directory
    const evilginxBasePath = path.resolve(process.cwd(), "../../");

    // Execute the evilginx command to get the exact URL
    const { stdout, stderr } = await execAsync(
      `cd ${evilginxBasePath} && ./evilginx -p .evilginx lures get-url ${lureIndex}`,
      { timeout: 5000 } // Set a reasonable timeout
    );

    if (stderr) {
      console.error("Error from evilginx command:", stderr);
    }

    // Extract the URL from the output
    // The output should be the URL on a line by itself
    const url = stdout.trim();

    if (!url.startsWith("http")) {
      return res.status(500).json({
        error: "Failed to get valid URL from evilginx",
        output: stdout,
      });
    }

    return res.status(200).json({ url });
  } catch (error) {
    console.error("Error executing evilginx command:", error);
    return res.status(500).json({
      error: "Failed to execute evilginx command",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
