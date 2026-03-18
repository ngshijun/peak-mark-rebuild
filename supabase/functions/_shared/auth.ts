import { createClient, type User } from '@supabase/supabase-js'
import { corsHeaders, errorResponse } from './stripe.ts'
import { supabaseAdmin } from './supabase-admin.ts'

/**
 * Authenticate the request and return the user.
 * Throws a Response if authentication fails.
 */
export async function getAuthenticatedUser(req: Request): Promise<User> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw errorResponse('No authorization header', 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw errorResponse('Unauthorized', 401)
  }

  return user
}

/**
 * Verify the user is a parent. Throws a Response if not.
 */
export async function verifyParent(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('user_type')
    .eq('id', userId)
    .single()

  if (profile?.user_type !== 'parent') {
    throw errorResponse('Only parents can perform this action', 403)
  }
}

/**
 * Verify a parent-student link exists. Throws a Response if not.
 */
export async function verifyParentStudentLink(parentId: string, studentId: string): Promise<void> {
  const { data: link } = await supabaseAdmin
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .single()

  if (!link) {
    throw errorResponse('Student not linked to parent', 403)
  }
}
