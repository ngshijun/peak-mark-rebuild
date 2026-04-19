/** Shape returned by Supabase join: sub_topics -> topics -> subjects -> grade_levels */
export interface SubTopicHierarchy {
  id: string
  name: string
  topics: {
    id: string
    name: string
    subjects: {
      id: string
      name: string
      grade_levels: { id: string; name: string }
    }
  }
}

/**
 * Coerce the Supabase-inferred `sub_topics` join result into a
 * `SubTopicHierarchy`. Supabase types 1-to-1 joins as possibly-singleton
 * objects and its inferred shape does not always match our declared type;
 * this single-site cast isolates the `unknown` boundary instead of
 * spreading `as unknown as SubTopicHierarchy` across every caller.
 *
 * Returns `null` if the join came back empty / null. Callers that treat
 * missing hierarchy as "Unknown" can chain with `??`.
 */
export function asSubTopicHierarchy(raw: unknown): SubTopicHierarchy | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as SubTopicHierarchy
}
