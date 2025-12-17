import { ref } from 'vue'
import { supabase } from '@/lib/supabaseClient'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type UserType = Database['public']['Enums']['user_type']

export interface AuthUser {
  id: string
  email: string
  name: string
  userType: UserType
  avatarPath: string | null
  dateOfBirth: string | null
  createdAt: string | null
  // Student-specific fields
  studentProfile?: {
    xp: number
    coins: number
    food: number
    gradeLevelId: string | null
    selectedPetId: string | null
  }
  // Parent-specific fields
  parentProfile?: {
    createdAt: string | null
  }
}

// Track loading and error states
const isLoading = ref(false)
const error = ref<string | null>(null)

/**
 * Sign up a new user with email and password
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  userType: 'student' | 'parent',
  dateOfBirth?: string,
): Promise<{ user: SupabaseUser | null; error: string | null }> {
  isLoading.value = true
  error.value = null

  try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          user_type: userType,
          date_of_birth: dateOfBirth,
        },
      },
    })

    if (signUpError) {
      error.value = signUpError.message
      return { user: null, error: signUpError.message }
    }

    return { user: data.user, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    error.value = message
    return { user: null, error: message }
  } finally {
    isLoading.value = false
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string,
): Promise<{ user: SupabaseUser | null; session: Session | null; error: string | null }> {
  isLoading.value = true
  error.value = null

  try {
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      error.value = signInError.message
      return { user: null, session: null, error: signInError.message }
    }

    return { user: data.user, session: data.session, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    error.value = message
    return { user: null, session: null, error: message }
  } finally {
    isLoading.value = false
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: string | null }> {
  isLoading.value = true
  error.value = null

  try {
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      // If session is not found, the user is effectively already logged out
      // Treat this as a successful logout rather than an error
      const isSessionGone =
        signOutError.message.includes('session_not_found') ||
        signOutError.code === 'session_not_found'

      if (!isSessionGone) {
        error.value = signOutError.message
        return { error: signOutError.message }
      }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    error.value = message
    return { error: message }
  } finally {
    isLoading.value = false
  }
}

/**
 * Get the current session
 */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Get the current user from Supabase auth
 */
export async function getCurrentUser(): Promise<SupabaseUser | null> {
  const { data } = await supabase.auth.getUser()
  return data.user
}

/**
 * Fetch the user's profile from the database
 * This includes the main profile and type-specific profile (student/parent)
 */
export async function fetchUserProfile(userId: string): Promise<AuthUser | null> {
  try {
    // Fetch main profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError)
      return null
    }

    const authUser: AuthUser = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      userType: profile.user_type,
      avatarPath: profile.avatar_path,
      dateOfBirth: profile.date_of_birth,
      createdAt: profile.created_at,
    }

    // Fetch type-specific profile
    if (profile.user_type === 'student') {
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (studentProfile) {
        authUser.studentProfile = {
          xp: studentProfile.xp ?? 0,
          coins: studentProfile.coins ?? 0,
          food: studentProfile.food ?? 0,
          gradeLevelId: studentProfile.grade_level_id,
          selectedPetId: studentProfile.selected_pet_id,
        }
      }
    } else if (profile.user_type === 'parent') {
      const { data: parentProfile } = await supabase
        .from('parent_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (parentProfile) {
        authUser.parentProfile = {
          createdAt: parentProfile.created_at,
        }
      }
    }

    return authUser
  } catch (err) {
    console.error('Error fetching user profile:', err)
    return null
  }
}

/**
 * Ensure the user's profile exists in the database
 * This is a fallback in case the DB trigger didn't create it on signup
 * Called on first login to guarantee profile exists
 */
export async function ensureProfileExists(
  user: SupabaseUser,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Check if profile already exists using maybeSingle() to avoid error when not found
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    // If profile exists, we're done
    if (existingProfile) {
      return { success: true, error: null }
    }

    // If there was an error other than "not found", return it
    if (checkError) {
      console.error('Error checking profile:', checkError)
      return { success: false, error: checkError.message }
    }

    // Profile doesn't exist, create it
    const userMetadata = user.user_metadata || {}
    const userType = (userMetadata.user_type as UserType) || 'student'
    const name = (userMetadata.name as string) || 'User'
    const dateOfBirth = userMetadata.date_of_birth as string | undefined

    // Create main profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email!,
      name,
      user_type: userType,
      date_of_birth: dateOfBirth || null,
    })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return { success: false, error: profileError.message }
    }

    // Create type-specific profile
    if (userType === 'student') {
      const { error: studentError } = await supabase.from('student_profiles').insert({
        id: user.id,
      })
      if (studentError) {
        console.error('Error creating student profile:', studentError)
      }
    } else if (userType === 'parent') {
      const { error: parentError } = await supabase.from('parent_profiles').insert({
        id: user.id,
      })
      if (parentError) {
        console.error('Error creating parent profile:', parentError)
      }
    }

    return { success: true, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return { success: false, error: message }
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  isLoading.value = true
  error.value = null

  try {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      error.value = resetError.message
      return { error: resetError.message }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    error.value = message
    return { error: message }
  } finally {
    isLoading.value = false
  }
}

/**
 * Update user password
 */
export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  isLoading.value = true
  error.value = null

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      error.value = updateError.message
      return { error: updateError.message }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    error.value = message
    return { error: message }
  } finally {
    isLoading.value = false
  }
}

/**
 * Composable hook for auth functionality
 */
export function useAuth() {
  return {
    isLoading,
    error,
    signUp,
    signIn,
    signOut,
    getSession,
    getCurrentUser,
    fetchUserProfile,
    ensureProfileExists,
    resetPassword,
    updatePassword,
  }
}
