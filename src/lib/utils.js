import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function for merging Tailwind classes
 * Used by shadcn components for className composition
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
