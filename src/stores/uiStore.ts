"use client";

import { create } from "zustand";

type ThemeMode = "light" | "dark" | "system";

type UIState = {
  sidebarOpen: boolean;
  theme: ThemeMode;
  activeModal: string | null;
  toggleSidebar: () => void;
  setTheme: (theme: ThemeMode) => void;
  openModal: (name: string) => void;
  closeModal: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: "system",
  activeModal: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
    set({ theme });
  },
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
}));
