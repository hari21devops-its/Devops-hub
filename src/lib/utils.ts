import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUsageValue(value: number, unit: string) {
  if (!['bytes', 'byte'].includes(unit.toLowerCase())) return `${value.toLocaleString()} ${unit}`
  const absolute = Math.abs(value)
  if (absolute >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`
  if (absolute >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`
  if (absolute >= 1024) return `${(value / 1024).toFixed(2)} KB`
  return `${value.toLocaleString()} bytes`
}
