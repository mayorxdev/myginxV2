import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { dbService } from "@/services/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      const sessions = await dbService.getSessions();
      return res.status(200).json({ sessions });
    } else if (req.method === "POST") {
      // Handle database content update
      const { sessions } = req.body;
      if (!Array.isArray(sessions)) {
        return res.status(400).json({ error: "Invalid Database format" });
      }

      const success = await dbService.updateSessions(sessions);
      if (!success) {
        return res.status(500).json({ error: "Failed to update Database" });
      }

      return res.status(200).json({ message: "Database updated successfully" });
    } else if (req.method === "DELETE") {
      // Create backup before clearing
      const sessions = await dbService.getSessions();
      const backupData = JSON.stringify(sessions, null, 2);
      const backupPath = path.join(process.cwd(), "data", "backup");

      // Ensure backup directory exists
      fs.mkdirSync(backupPath, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFile = path.join(
        backupPath,
        `sessions-backup-${timestamp}.json`
      );
      fs.writeFileSync(backupFile, backupData);

      // Clear databases
      const workspaceDir = path.join(process.cwd(), "../../..");
      const sourceDbPath = path.join(workspaceDir, ".evilginx", "data.db");
      const localDbPath = path.join(process.cwd(), "data", "evilginx.db");

      try {
        // Clear source database
        if (fs.existsSync(sourceDbPath)) {
          fs.writeFileSync(sourceDbPath, "");
        }

        // Clear local database
        if (fs.existsSync(localDbPath)) {
          fs.writeFileSync(localDbPath, "");
        }

        // Clear sessions from the service
        await dbService.clearSessions();

        return res.status(200).json({
          message: "Databases cleared successfully",
          backupFile: path.basename(backupFile),
        });
      } catch (error) {
        console.error("Error clearing databases:", error);
        return res.status(500).json({ error: "Failed to clear databases" });
      }
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error handling database management:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
