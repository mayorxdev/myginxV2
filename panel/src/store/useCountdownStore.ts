import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const isServer = typeof window === "undefined";

interface CountdownState {
  startDate: number | null;
  endDate: number | null;
  setStartDate: (date: number) => void;
}

// Create a dummy storage for server-side rendering
const dummyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// Get the appropriate storage based on environment
const getStorage = () => {
  if (isServer) return dummyStorage;
  return localStorage;
};

export const useCountdownStore = create<CountdownState>()(
  persist(
    (set) => ({
      startDate: null,
      endDate: null,
      setStartDate: (date: number) => {
        const endDate = date + 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        set({ startDate: date, endDate });
      },
    }),
    {
      name: "countdown-storage",
      storage: createJSONStorage(() => getStorage()),
      skipHydration: true,
    }
  )
);
