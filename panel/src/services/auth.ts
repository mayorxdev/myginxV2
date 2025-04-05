import { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function verifyAuth(req: NextApiRequest) {
  const token = req.cookies["auth-token"];

  if (!token) {
    return false;
  }

  try {
    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    return verified.payload;
  } catch (err) {
    return false;
  }
}

export async function withAuth(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const isAuthenticated = await verifyAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    return handler(req, res);
  };
}
