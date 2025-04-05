import { Session } from "../types";

export async function fetchSessions(): Promise<Session[]> {
  const response = await fetch("/api/sessions");
  if (!response.ok) {
    throw new Error("Failed to fetch sessions");
  }
  return response.json();
}
