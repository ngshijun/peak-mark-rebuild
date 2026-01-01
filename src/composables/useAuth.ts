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

// Module-level loading/error state (used by exported functions)
// Note: For component-specific state, use the useAuth() composable which provides instance-local refs
const moduleIsLoading = ref(false)
const moduleError = ref<string | null>(null)

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
  moduleIsLoading.value = true
  moduleError.value = null

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
      moduleError.value = signUpError.message
      return { user: null, error: signUpError.message }
    }

    return { user: data.user, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    moduleError.value = message
    return { user: null, error: message }
  } finally {
    moduleIsLoading.value = false
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string,
): Promise<{ user: SupabaseUser | null; session: Session | null; error: string | null }> {
  moduleIsLoading.value = true
  moduleError.value = null

  try {
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      moduleError.value = signInError.message
      return { user: null, session: null, error: signInError.message }
    }

    return { user: data.user, session: data.session, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    moduleError.value = message
    return { user: null, session: null, error: message }
  } finally {
    moduleIsLoading.value = false
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: string | null }> {
  moduleIsLoading.value = true
  moduleError.value = null

  try {
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      // If session is not found, the user is effectively already logged out
      // Treat this as a successful logout rather than an error
      const isSessionGone =
        signOutError.message.includes('session_not_found') ||
        signOutError.code === 'session_not_found'

      if (!isSessionGone) {
        moduleError.value = signOutError.message
        return { error: signOutError.message }
      }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    moduleError.value = message
    return { error: message }
  } finally {
    moduleIsLoading.value = false
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

    // Profile doesn't exist, create it atomically using RPC function
    const userMetadata = user.user_metadata || {}
    const userType = (userMetadata.user_type as UserType) || 'student'
    const name = (userMetadata.name as string) || 'User'
    const dateOfBirth = userMetadata.date_of_birth as string | undefined

    // Create main profile and type-specific profile atomically
    const { error: rpcError } = await supabase.rpc('create_user_profile', {
      p_user_id: user.id,
      p_email: user.email!,
      p_name: name,
      p_user_type: userType,
      p_date_of_birth: dateOfBirth,
    })

    if (rpcError) {
      console.error('Error creating profile:', rpcError)
      return { success: false, error: rpcError.message }
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
  moduleIsLoading.value = true
  moduleError.value = null

  try {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      moduleError.value = resetError.message
      return { error: resetError.message }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    moduleError.value = message
    return { error: message }
  } finally {
    moduleIsLoading.value = false
  }
}

/**
 * Update user password
 */
export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  moduleIsLoading.value = true
  moduleError.value = null

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      moduleError.value = updateError.message
      return { error: updateError.message }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    moduleError.value = message
    return { error: message }
  } finally {
    moduleIsLoading.value = false
  }
}

/**
 * Composable hook for auth functionality
 * Returns instance-local refs to prevent state pollution between components
 */
export function useAuth() {
  // Instance-local state to prevent pollution between components
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Wrapper functions that use instance-local state
  async function wrappedResetPassword(email: string): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null
    try {
      const result = await resetPassword(email)
      if (result.error) {
        error.value = result.error
      }
      return result
    } finally {
      isLoading.value = false
    }
  }

  async function wrappedUpdatePassword(newPassword: string): Promise<{ error: string | null }> {
    isLoading.value = true
    error.value = null
    try {
      const result = await updatePassword(newPassword)
      if (result.error) {
        error.value = result.error
      }
      return result
    } finally {
      isLoading.value = false
    }
  }

  return {
    // Instance-local state
    isLoading,
    error,
    // Functions that use instance-local state
    resetPassword: wrappedResetPassword,
    updatePassword: wrappedUpdatePassword,
    // Other functions (don't need local state tracking as they return errors directly)
    signUp,
    signIn,
    signOut,
    getSession,
    getCurrentUser,
    fetchUserProfile,
    ensureProfileExists,
  }
}
