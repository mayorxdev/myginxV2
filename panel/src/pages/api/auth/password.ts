import { NextApiRequest, NextApiResponse } from "next";
import { verifyAuth } from "@/services/auth";
import { dbService } from "@/services/database";
import { validatePassword } from "@/utils/validation";

interface JWTPayload {
  username: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const payload = await verifyAuth(req);
  if (!payload || typeof payload === "boolean") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { currentPassword, newPassword } = req.body;

  // Validate current password
  if (!currentPassword) {
    return res.status(400).json({ message: "Current password is required" });
  }

  // Verify current password
  const jwtPayload = payload as unknown as JWTPayload;
  const { isValid } = await dbService.verifyCredentials(
    jwtPayload.username,
    currentPassword
  );

  if (!isValid) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  // Validate new password
  const passwordErrors = validatePassword(newPassword);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ message: passwordErrors[0] });
  }

  try {
    await dbService.updatePassword(newPassword);
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({
      message:
        error instanceof Error ? error.message : "Failed to update password",
    });
  }
}
