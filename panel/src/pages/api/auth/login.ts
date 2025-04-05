import { NextApiRequest, NextApiResponse } from "next";
import { SignJWT } from "jose";
import { serialize } from "cookie";
import { dbService } from "../../../services/database";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { username, password } = req.body;

  try {
    // Verify credentials
    const { isValid, isFirstLogin } = await dbService.verifyCredentials(
      username,
      password
    );

    if (!isValid) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Create JWT token
    const token = await new SignJWT({ username })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(new TextEncoder().encode(JWT_SECRET));

    // Set cookie
    const cookie = serialize("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 86400, // 24 hours
      path: "/",
    });

    res.setHeader("Set-Cookie", cookie);
    return res.status(200).json({
      message: "Logged in successfully",
      isFirstLogin,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "An error occurred during login. Please try again later.",
    });
  }
}
