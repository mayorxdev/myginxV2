import { NextApiRequest, NextApiResponse } from "next";
import { dbService } from "../../../services/database";
import { validatePassword } from "../../../utils/validation";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { newUsername, newPassword } = req.body;

  // Validate inputs
  if (!newUsername || !newPassword) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  // Validate password
  const passwordErrors = validatePassword(newPassword);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ message: passwordErrors[0] });
  }

  try {
    // Update credentials
    await dbService.updateCredentials("admin", newUsername, newPassword);

    return res
      .status(200)
      .json({ message: "Credentials updated successfully" });
  } catch (error) {
    console.error("Error updating credentials:", error);
    return res.status(500).json({
      message:
        error instanceof Error ? error.message : "Failed to update credentials",
    });
  }
}
