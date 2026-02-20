import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleString();
}

export function formatRelativeTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNowStrict(value, { addSuffix: true });
}

export function generateSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]) {
  return keys.reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {} as Pick<T, K>);
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]) {
  const copy = { ...obj };
  for (const key of keys) {
    delete copy[key];
  }
  return copy as Omit<T, K>;
}
