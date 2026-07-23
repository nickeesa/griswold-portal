import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard shadcn class-name helper: merge conditional clsx output and dedupe
// conflicting Tailwind utilities.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
