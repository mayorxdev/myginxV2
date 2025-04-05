import Link from "next/link";
import { useRouter } from "next/router";

export default function Sidebar() {
  const router = useRouter();
  const isActive = (path: string) => router.pathname === path;

  return (
    <div className="fixed w-64 h-screen bg-[#232A34]">
      <div className="p-4">
        <h1 className="text-white text-xl font-bold">Admin Panel</h1>
      </div>
      <nav className="mt-8">
        <Link
          href="/"
          className={`block px-4 py-5 text-gray-300 hover:bg-[#1B2028] ${
            isActive("/") ? "bg-[#1B2028]" : ""
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/settings"
          className={`block px-4 py-5 text-gray-300 hover:bg-[#1B2028] ${
            isActive("/settings") ? "bg-[#1B2028]" : ""
          }`}
        >
          Settings
        </Link>
        <Link
          href="/tutorial"
          className={`block px-4 py-5 text-gray-300 hover:bg-[#1B2028] ${
            isActive("/tutorial") ? "bg-[#1B2028]" : ""
          }`}
        >
          Tutorial
        </Link>
      </nav>
    </div>
  );
}
