/**
 * Generic session filtering utilities.
 *
 * These pure functions operate on any session type that implements
 * FilterableSession, eliminating duplication across stores that
 * all share the same grade→subject→topic→subtopic cascading filter pattern.
 */

export type DateRangeFilter = 'today' | 'last7days' | 'last30days' | 'alltime'

/** Minimum fields required for filtering and available-options extraction */
export interface FilterableSession {
  gradeLevelName: string
  subjectName: string
  topicName: string
  subTopicName: string
  completedAt: string | null
}

export interface SessionFilterParams {
  gradeLevelName?: string
  subjectName?: string
  topicName?: string
  subTopicName?: string
  dateRange?: DateRangeFilter
}

/**
 * Returns the start date for a given date range filter.
 * Returns null for 'alltime' (no filtering).
 */
export function getDateRangeStart(filter: DateRangeFilter): Date | null {
  const now = new Date()
  switch (filter) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'last7days':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    case 'last30days':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    case 'alltime':
    default:
      return null
  }
}

/**
 * Filter sessions by cascading criteria (grade, subject, topic, subtopic, date range).
 * In-progress sessions (completedAt === null) are always included regardless of date filter.
 */
export function filterSessions<T extends FilterableSession>(
  sessions: T[],
  filters: SessionFilterParams,
): T[] {
  const dateRangeStart = filters.dateRange ? getDateRangeStart(filters.dateRange) : null

  return sessions.filter((s) => {
    if (filters.gradeLevelName && s.gradeLevelName !== filters.gradeLevelName) return false
    if (filters.subjectName && s.subjectName !== filters.subjectName) return false
    if (filters.topicName && s.topicName !== filters.topicName) return false
    if (filters.subTopicName && s.subTopicName !== filters.subTopicName) return false
    // Date filter applies to completedAt; in-progress sessions always shown
    if (dateRangeStart && s.completedAt) {
      const sessionDate = new Date(s.completedAt)
      if (sessionDate < dateRangeStart) return false
    }
    return true
  })
}

/** Get unique grade levels from sessions, sorted alphabetically */
export function getUniqueGradeLevels<T extends FilterableSession>(sessions: T[]): string[] {
  return Array.from(new Set(sessions.map((s) => s.gradeLevelName))).sort()
}

/** Get unique subjects, optionally filtered by grade level */
export function getUniqueSubjects<T extends FilterableSession>(
  sessions: T[],
  gradeLevelName?: string,
): string[] {
  const filtered = gradeLevelName
    ? sessions.filter((s) => s.gradeLevelName === gradeLevelName)
    : sessions
  return Array.from(new Set(filtered.map((s) => s.subjectName))).sort()
}

/** Get unique topics, optionally filtered by grade level and subject */
export function getUniqueTopics<T extends FilterableSession>(
  sessions: T[],
  gradeLevelName?: string,
  subjectName?: string,
): string[] {
  let filtered = sessions
  if (gradeLevelName) {
    filtered = filtered.filter((s) => s.gradeLevelName === gradeLevelName)
  }
  if (subjectName) {
    filtered = filtered.filter((s) => s.subjectName === subjectName)
  }
  return Array.from(new Set(filtered.map((s) => s.topicName))).sort()
}

/** Get unique subtopics, optionally filtered by grade level, subject, and topic */
export function getUniqueSubTopics<T extends FilterableSession>(
  sessions: T[],
  gradeLevelName?: string,
  subjectName?: string,
  topicName?: string,
): string[] {
  let filtered = sessions
  if (gradeLevelName) {
    filtered = filtered.filter((s) => s.gradeLevelName === gradeLevelName)
  }
  if (subjectName) {
    filtered = filtered.filter((s) => s.subjectName === subjectName)
  }
  if (topicName) {
    filtered = filtered.filter((s) => s.topicName === topicName)
  }
  return Array.from(new Set(filtered.map((s) => s.subTopicName))).sort()
}
