import { useState } from "react";
import { useRouter } from "next/router";
// import Image from "next/image";
import { toast, Toaster } from "react-hot-toast";

export default function Login() {
  const router = useRouter();
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Login failed");
        return;
      }

      // Show success toast
      toast.success("Login successful!");

      if (data.isFirstLogin) {
        router.push("/first-login");
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1B2028] flex items-center justify-center">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#333",
            color: "#fff",
          },
          success: {
            duration: 3000,
          },
          error: {
            duration: 4000,
          },
        }}
      />
      <div className="bg-[#232A34] p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-left mb-8">
          <h2 className="text-white text-2xl font-bold">Login</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-400 mb-2">Username</label>
            <input
              type="text"
              data-allow-select="true"
              className="w-full bg-[#1B2028] text-white p-3 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={credentials.username}
              onChange={(e) =>
                setCredentials({ ...credentials, username: e.target.value })
              }
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Password</label>
            <input
              type="password"
              data-allow-select="true"
              className="w-full bg-[#1B2028] text-white p-3 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={credentials.password}
              onChange={(e) =>
                setCredentials({ ...credentials, password: e.target.value })
              }
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-indigo-500 text-white p-3 rounded ${
              loading ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600"
            } transition-colors`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
