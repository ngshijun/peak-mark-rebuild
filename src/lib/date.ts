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

// ─── Display formatting utilities ────────────────────────────────────────────

/**
 * Formats seconds into a human-readable study time string.
 * Examples: "5 sec", "3 min", "1 hr 30 min"
 */
export function formatStudyTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} sec`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) {
    return `${hours} hr`
  }
  return `${hours} hr ${remainingMinutes} min`
}

/**
 * Formats seconds into a compact duration string.
 * Examples: "5s", "3m", "1m 30s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Formats a date string into a locale date-time string.
 * Example: "Jan 1, 2025, 10:30 AM"
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formats a date string into a short date string.
 * Example: "Jan 1, 2025"
 * Returns '-' for null/undefined input.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a date string into a long date string.
 * Example: "January 1, 2025"
 * Returns '-' for null/undefined input.
 */
export function formatLongDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Formats a date string into a long date-time string.
 * Example: "January 1, 2025, 10:30 AM"
 * Returns '' for null/undefined input.
 */
export function formatLongDateTime(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Formats a date string as a relative date.
 * Examples: "Today", "Yesterday", "3d ago", "2w ago", falls back to formatDate.
 * Returns 'Never' for null/undefined input.
 */
export function formatRelativeDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) return 'Yesterday'

  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return formatDate(dateString)
}

/**
 * Formats a date string as a relative time ago.
 * Examples: "just now", "5 minutes ago", "3 hours ago", "2 days ago", falls back to short date.
 * Returns '' for null/undefined input.
 */
export function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
