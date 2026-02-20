"use client";

import { create } from "zustand";

type WidgetLayout = {
  widgetId: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

type DashboardState = {
  widgetLayout: WidgetLayout[];
  dateRange: { from?: string; to?: string };
  activeFilters: Record<string, unknown>;
  setLayout: (layout: WidgetLayout[]) => void;
  setDateRange: (range: { from?: string; to?: string }) => void;
  setFilter: (key: string, value: unknown) => void;
  clearFilters: () => void;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  widgetLayout: [],
  dateRange: {},
  activeFilters: {},
  setLayout: (layout) => set({ widgetLayout: layout }),
  setDateRange: (range) => set({ dateRange: range }),
  setFilter: (key, value) => set((state) => ({ activeFilters: { ...state.activeFilters, [key]: value } })),
  clearFilters: () => set({ activeFilters: {} }),
}));
