import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Session {
  session_id: string;
  username: string;
  device_info: string;
  last_active: string;
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/auth/sessions");
      if (!response.ok) throw new Error("Failed to fetch sessions");
      const data = await response.json();

      // Sort sessions by last_active and limit to 2 most recent
      const sortedSessions = data
        .sort(
          (a: Session, b: Session) =>
            new Date(b.last_active).getTime() -
            new Date(a.last_active).getTime()
        )
        .slice(0, 2);

      setSessions(sortedSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to end session");
      }

      toast.success("Session ended successfully");
      await fetchSessions(); // Refresh the sessions list
    } catch (error) {
      console.error("Error ending session:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to end session"
      );
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Unknown";

      // If date is today, show time only
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });
      }

      // If date is within last 7 days, show day and time
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (date > sevenDaysAgo) {
        return date.toLocaleString("en-US", {
          weekday: "short",
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });
      }

      // Otherwise show full date
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
    } catch {
      return "Unknown";
    }
  };

  const getDeviceInfo = (deviceInfoString: string) => {
    try {
      const deviceInfo = JSON.parse(deviceInfoString);
      const browser = deviceInfo.browser.name || "Unknown browser";
      const os = deviceInfo.os.name || "Unknown OS";
      const device = deviceInfo.device.type
        ? deviceInfo.device.type.charAt(0).toUpperCase() +
          deviceInfo.device.type.slice(1)
        : "Desktop";

      return `${device} - ${browser} on ${os}`;
    } catch {
      return "Unknown device";
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-[#1B2028] p-4 rounded-lg">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.length === 0 ? (
        <div className="text-gray-400">No active sessions</div>
      ) : (
        sessions.map((session) => (
          <div
            key={session.session_id}
            className="bg-[#1B2028] p-4 rounded-lg flex items-center justify-between"
          >
            <div>
              <div className="text-white font-medium">
                {getDeviceInfo(session.device_info)}
              </div>
              <div className="text-gray-400 text-sm">
                Last active: {formatDate(session.last_active)}
              </div>
            </div>
            <button
              onClick={() => handleLogout(session.session_id)}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              End Session
            </button>
          </div>
        ))
      )}
    </div>
  );
}
