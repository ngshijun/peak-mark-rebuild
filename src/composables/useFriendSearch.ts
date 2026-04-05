import { ref, watch } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/stores/auth'

export interface FriendSearchResult {
  id: string
  name: string
  avatarPath: string | null
}

const DEBOUNCE_MS = 300
const SEARCH_LIMIT = 10
const FRIEND_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i

export function useFriendSearch() {
  const authStore = useAuthStore()
  const searchTerm = ref('')
  const results = ref<FriendSearchResult[]>([])
  const isSearching = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let currentVersion = 0

  async function search(query: string) {
    const version = ++currentVersion
    const userId = authStore.user?.id
    if (!userId || !query) {
      results.value = []
      return
    }

    isSearching.value = true
    try {
      const isFriendCode = FRIEND_CODE_PATTERN.test(query)

      let data: any[] | null = null

      if (isFriendCode) {
        const { data: codeResults, error } = await supabase
          .from('student_profiles')
          .select('id, profiles!inner(name, avatar_path)')
          .eq('friend_code', query.toUpperCase())
          .neq('id', userId)
          .limit(1)

        if (error) throw error
        data = codeResults
      } else {
        const { data: nameResults, error } = await supabase
          .from('student_profiles')
          .select('id, profiles!inner(name, avatar_path)')
          .neq('id', userId)
          .ilike('profiles.name', `%${query}%`)
          .limit(SEARCH_LIMIT)

        if (error) throw error
        data = nameResults
      }

      if (version !== currentVersion) return

      results.value = (data ?? []).map((row) => ({
        id: row.id,
        name: (row as any).profiles.name,
        avatarPath: (row as any).profiles.avatar_path,
      }))
    } catch {
      if (version === currentVersion) results.value = []
    } finally {
      if (version === currentVersion) isSearching.value = false
    }
  }

  watch(searchTerm, (value) => {
    if (debounceTimer) clearTimeout(debounceTimer)

    const trimmed = value.trim()
    if (!trimmed) {
      currentVersion++
      results.value = []
      isSearching.value = false
      return
    }

    debounceTimer = setTimeout(() => search(trimmed), DEBOUNCE_MS)
  })

  function clear() {
    searchTerm.value = ''
    results.value = []
  }

  return { searchTerm, results, isSearching, clear }
}
