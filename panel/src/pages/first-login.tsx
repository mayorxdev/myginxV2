import { useState } from "react";
import { useRouter } from "next/router";
import { useApiError } from "@/hooks/useApiError";
import ErrorAlert from "@/components/ErrorAlert";
import { validatePassword } from "@/utils/validation";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";

export default function FirstLogin() {
  const router = useRouter();
  const { error, handleError, clearError } = useApiError();
  const [credentials, setCredentials] = useState({
    newUsername: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (credentials.newPassword !== credentials.confirmPassword) {
      setErrors(["Passwords do not match"]);
      return;
    }

    const passwordErrors = validatePassword(credentials.newPassword);
    if (passwordErrors.length > 0) {
      setErrors(passwordErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/update-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newUsername: credentials.newUsername,
          newPassword: credentials.newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update credentials");
      }

      router.push("/");
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1B2028] flex items-center justify-center">
      <div className="bg-[#232A34] p-8 rounded-lg w-full max-w-md">
        <h1 className="text-white text-2xl font-bold mb-6">
          Update Credentials
        </h1>
        <p className="text-gray-400 mb-6">
          Please update your username and password for security purposes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 mb-2">New Username</label>
            <input
              type="text"
              className="w-full bg-[#1B2028] text-white p-3 rounded"
              value={credentials.newUsername}
              onChange={(e) =>
                setCredentials({ ...credentials, newUsername: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">New Password</label>
            <input
              type="password"
              className="w-full bg-[#1B2028] text-white p-3 rounded"
              value={credentials.newPassword}
              onChange={(e) =>
                setCredentials({ ...credentials, newPassword: e.target.value })
              }
              required
            />
            <PasswordStrengthIndicator password={credentials.newPassword} />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Confirm Password</label>
            <input
              type="password"
              className="w-full bg-[#1B2028] text-white p-3 rounded"
              value={credentials.confirmPassword}
              onChange={(e) =>
                setCredentials({
                  ...credentials,
                  confirmPassword: e.target.value,
                })
              }
              required
            />
          </div>

          {errors.length > 0 && (
            <ul className="text-red-500 text-sm">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-indigo-500 text-white p-3 rounded ${
              loading ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600"
            }`}
          >
            {loading ? "Updating..." : "Update Credentials"}
          </button>
        </form>
      </div>
      {error && <ErrorAlert message={error.message} onClose={clearError} />}
    </div>
  );
}
