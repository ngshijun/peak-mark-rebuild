/**
 * Date utilities for Asia/Kuala_Lumpur (MYT, UTC+8) timezone.
 *
 * The app's business logic (daily statuses, streaks, spin wheel, leaderboard)
 * is anchored to MYT. Using Intl.DateTimeFormat with an explicit IANA timezone
 * ensures correct dates regardless of the user's browser timezone.
 */

const MYT_TIMEZONE = 'Asia/Kuala_Lumpur'

/** Formatter that outputs YYYY-MM-DD in MYT (en-CA locale gives this format) */
const mytDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MYT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Returns a YYYY-MM-DD date string in Asia/Kuala_Lumpur timezone.
 * Always reflects the MYT calendar date, even if the browser is in another timezone.
 */
export function toMYTDateString(date: Date = new Date()): string {
  return mytDateFormatter.format(date)
}

/** Formatter that outputs numeric date parts in MYT */
const mytPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MYT_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
})

/**
 * Returns the day of week in MYT (0 = Sun, 1 = Mon, ..., 6 = Sat).
 */
export function getMYTDayOfWeek(date: Date = new Date()): number {
  const parts = mytPartsFormatter.formatToParts(date)
  const weekday = parts.find((p) => p.type === 'weekday')!.value
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[weekday] ?? 0
}

/**
 * Returns a UTC Date object representing midnight of the given MYT date string.
 * Useful for date arithmetic (adding/subtracting days) on MYT calendar dates.
 *
 * Example: mytDateToUTCDate('2026-02-12') → Date(2026-02-12T00:00:00Z)
 */
export function mytDateToUTCDate(mytDateStr: string): Date {
  const parts = mytDateStr.split('-').map(Number)
  return new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]))
}

/**
 * Formats a UTC Date (from mytDateToUTCDate) back to YYYY-MM-DD string.
 */
export function utcDateToString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
