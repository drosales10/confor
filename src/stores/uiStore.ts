"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ThemeMode = "light" | "dark" | "system";

type UIState = {
  sidebarOpen: boolean;
  geoPanelCollapsed: boolean;
  geoLegendVisible: boolean;
  theme: ThemeMode;
  activeModal: string | null;
  toggleSidebar: () => void;
  toggleGeoPanel: () => void;
  toggleGeoLegend: () => void;
  setTheme: (theme: ThemeMode) => void;
  openModal: (name: string) => void;
  closeModal: () => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      geoPanelCollapsed: false,
      geoLegendVisible: true,
      theme: "system",
      activeModal: null,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleGeoPanel: () => set((state) => ({ geoPanelCollapsed: !state.geoPanelCollapsed })),
      toggleGeoLegend: () => set((state) => ({ geoLegendVisible: !state.geoLegendVisible })),
      setTheme: (theme) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("theme", theme);
        }
        set({ theme });
      },
      openModal: (name) => set({ activeModal: name }),
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: "confor-ui-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        geoPanelCollapsed: state.geoPanelCollapsed,
        geoLegendVisible: state.geoLegendVisible,
      }),
    },
  ),
);
