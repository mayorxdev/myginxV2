import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1B2028] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1B2028] flex">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-8 overflow-auto">
          <Toaster position="top-right" />
          {children}
        </main>
      </div>
    </div>
  );
}
