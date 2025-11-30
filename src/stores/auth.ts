import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signOut as authSignOut,
  fetchUserProfile,
  ensureProfileExists,
  type AuthUser,
} from '@/composables/useAuth'
import type { Database } from '@/types/database.types'

type UserType = Database['public']['Enums']['user_type']

// XP required for each level (cumulative)
const XP_PER_LEVEL = 500

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const isLoading = ref(false)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const userType = computed<UserType | null>(() => user.value?.userType ?? null)

  // Student-specific computed properties
  const isStudent = computed(() => user.value?.userType === 'student')
  const isParent = computed(() => user.value?.userType === 'parent')
  const isAdmin = computed(() => user.value?.userType === 'admin')

  const studentProfile = computed(() => {
    if (user.value?.userType === 'student') {
      return user.value.studentProfile
    }
    return null
  })

  const currentLevel = computed(() => {
    if (!studentProfile.value) return 1
    return Math.floor(studentProfile.value.xp / XP_PER_LEVEL) + 1
  })

  const currentLevelXp = computed(() => {
    if (!studentProfile.value) return 0
    return studentProfile.value.xp % XP_PER_LEVEL
  })

  const xpToNextLevel = computed(() => XP_PER_LEVEL)

  const xpProgress = computed(() => {
    if (!studentProfile.value) return 0
    return Math.round((currentLevelXp.value / XP_PER_LEVEL) * 100)
  })

  /**
   * Initialize auth state by checking for existing session
   */
  async function initialize() {
    if (isInitialized.value) return

    isLoading.value = true
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        // Ensure profile exists
        await ensureProfileExists(session.user)
        // Fetch the user profile
        const profile = await fetchUserProfile(session.user.id)
        if (profile) {
          user.value = profile
        }
      }
    } catch (err) {
      console.error('Error initializing auth:', err)
    } finally {
      isLoading.value = false
      isInitialized.value = true
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Ensure profile exists on sign in
        await ensureProfileExists(session.user)
        const profile = await fetchUserProfile(session.user.id)
        if (profile) {
          user.value = profile
        }
      } else if (event === 'SIGNED_OUT') {
        user.value = null
      } else if (event === 'USER_UPDATED' && session?.user) {
        const profile = await fetchUserProfile(session.user.id)
        if (profile) {
          user.value = profile
        }
      }
    })
  }

  /**
   * Sign up a new user
   */
  async function signUp(
    email: string,
    password: string,
    name: string,
    userTypeParam: 'student' | 'parent',
    dateOfBirth?: string,
  ) {
    isLoading.value = true
    try {
      const result = await authSignUp(email, password, name, userTypeParam, dateOfBirth)
      return result
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign in with email and password
   */
  async function signIn(email: string, password: string) {
    isLoading.value = true
    try {
      const result = await authSignIn(email, password)
      if (result.user && !result.error) {
        // Ensure profile exists on first login
        await ensureProfileExists(result.user)
        // Fetch the user profile
        const profile = await fetchUserProfile(result.user.id)
        if (profile) {
          user.value = profile
        }
      }
      return result
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign out the current user
   */
  async function signOut() {
    isLoading.value = true
    try {
      const result = await authSignOut()
      if (!result.error) {
        user.value = null
      }
      return result
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Refresh user profile from database
   */
  async function refreshProfile() {
    if (!user.value) return

    const profile = await fetchUserProfile(user.value.id)
    if (profile) {
      user.value = profile
    }
  }

  /**
   * Update user's name
   */
  async function updateName(name: string) {
    if (!user.value) return { error: 'Not authenticated' }

    const { error } = await supabase.from('profiles').update({ name }).eq('id', user.value.id)

    if (error) {
      return { error: error.message }
    }

    user.value.name = name
    return { error: null }
  }

  /**
   * Update user's avatar
   */
  async function updateAvatar(avatarPath: string) {
    if (!user.value) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_path: avatarPath })
      .eq('id', user.value.id)

    if (error) {
      return { error: error.message }
    }

    user.value.avatarPath = avatarPath
    return { error: null }
  }

  /**
   * Update student's grade level
   */
  async function updateGradeLevel(gradeLevelId: string) {
    if (!user.value || user.value.userType !== 'student') {
      return { error: 'Not a student' }
    }

    const { error } = await supabase
      .from('student_profiles')
      .update({ grade_level_id: gradeLevelId })
      .eq('id', user.value.id)

    if (error) {
      return { error: error.message }
    }

    if (user.value.studentProfile) {
      user.value.studentProfile.gradeLevelId = gradeLevelId
    }
    return { error: null }
  }

  /**
   * Add XP to student (updates local state and database)
   */
  async function addXp(amount: number) {
    if (!user.value || user.value.userType !== 'student' || !user.value.studentProfile) {
      return { error: 'Not a student' }
    }

    const newXp = user.value.studentProfile.xp + amount

    const { error } = await supabase
      .from('student_profiles')
      .update({ xp: newXp })
      .eq('id', user.value.id)

    if (error) {
      return { error: error.message }
    }

    user.value.studentProfile.xp = newXp
    return { error: null }
  }

  /**
   * Add coins to student
   */
  async function addCoins(amount: number) {
    if (!user.value || user.value.userType !== 'student' || !user.value.studentProfile) {
      return { error: 'Not a student' }
    }

    const newCoins = Math.max(0, user.value.studentProfile.coins + amount)

    const { error } = await supabase
      .from('student_profiles')
      .update({ coins: newCoins })
      .eq('id', user.value.id)

    if (error) {
      return { error: error.message }
    }

    user.value.studentProfile.coins = newCoins
    return { error: null }
  }

  /**
   * Spend coins (returns false if insufficient)
   */
  async function spendCoins(amount: number): Promise<boolean> {
    if (!user.value || user.value.userType !== 'student' || !user.value.studentProfile) {
      return false
    }

    if (user.value.studentProfile.coins < amount) {
      return false
    }

    const result = await addCoins(-amount)
    return !result.error
  }

  /**
   * Add food to student
   */
  async function addFood(amount: number) {
    if (!user.value || user.value.userType !== 'student' || !user.value.studentProfile) {
      return { error: 'Not a student' }
    }

    const newFood = Math.max(0, user.value.studentProfile.food + amount)

    const { error } = await supabase
      .from('student_profiles')
      .update({ food: newFood })
      .eq('id', user.value.id)

    if (error) {
      return { error: error.message }
    }

    user.value.studentProfile.food = newFood
    return { error: null }
  }

  /**
   * Use food (returns false if insufficient)
   */
  async function useFood(amount: number): Promise<boolean> {
    if (!user.value || user.value.userType !== 'student' || !user.value.studentProfile) {
      return false
    }

    if (user.value.studentProfile.food < amount) {
      return false
    }

    const result = await addFood(-amount)
    return !result.error
  }

  /**
   * Set selected pet
   */
  async function setSelectedPet(petId: string | null) {
    if (!user.value || user.value.userType !== 'student' || !user.value.studentProfile) {
      return { error: 'Not a student' }
    }

    const { error } = await supabase
      .from('student_profiles')
      .update({ selected_pet_id: petId })
      .eq('id', user.value.id)

    if (error) {
      return { error: error.message }
    }

    user.value.studentProfile.selectedPetId = petId
    return { error: null }
  }

  return {
    // State
    user,
    isLoading,
    isInitialized,

    // Computed
    isAuthenticated,
    userType,
    isStudent,
    isParent,
    isAdmin,
    studentProfile,
    currentLevel,
    currentLevelXp,
    xpToNextLevel,
    xpProgress,

    // Actions
    initialize,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    updateName,
    updateAvatar,
    updateGradeLevel,
    addXp,
    addCoins,
    spendCoins,
    addFood,
    useFood,
    setSelectedPet,
  }
})
