import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function displayEmptyForZero(value: string | number | null | undefined) {
  if (value == null) return ""
  if (typeof value === "number") return value <= 0 ? "" : String(value)
  const trimmed = value.trim()
  return trimmed === "" || trimmed === "0" ? "" : value
}

export function parseNumberInput(value: string) {
  if (!value.trim()) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
