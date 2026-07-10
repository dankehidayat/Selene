import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind class lists safely (later classes override earlier
 * conflicting ones instead of both being applied). Use this any time a
 * component accepts a `className` prop alongside its own defaults.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
