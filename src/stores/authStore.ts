"use client";

import { create } from "zustand";

type AuthState = {
  currentUser: { id: string; email: string } | null;
  permissions: string[];
  roles: string[];
  isAuthenticated: boolean;
  setUser: (user: { id: string; email: string }, roles: string[], permissions: string[]) => void;
  clearUser: () => void;
  hasPermission: (module: string, action: string) => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  permissions: [],
  roles: [],
  isAuthenticated: false,
  setUser: (user, roles, permissions) => set({ currentUser: user, roles, permissions, isAuthenticated: true }),
  clearUser: () => set({ currentUser: null, roles: [], permissions: [], isAuthenticated: false }),
  hasPermission: (module, action) => {
    const permission = `${module}:${action}`;
    const adminPermission = `${module}:ADMIN`;
    const permissions = get().permissions;
    return permissions.includes(permission) || permissions.includes(adminPermission);
  },
}));
