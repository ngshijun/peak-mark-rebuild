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
