import type { AuthError } from '@supabase/supabase-js'
import { useLanguageStore } from '@/stores/language'
import { handleError } from '@/lib/errors'

const codeToKey = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  user_already_exists: 'userAlreadyExists',
  weak_password: 'weakPassword',
  same_password: 'samePassword',
  over_email_send_rate_limit: 'rateLimited',
  invalid_token_hash: 'invalidToken',
  otp_expired: 'expiredToken',
} as const

/**
 * Translate a Supabase AuthError to the user's active UI language.
 * Unmapped error codes fall back to the raw English error message.
 *
 * Can be called from anywhere (script/composable/store) because it
 * resolves the language store internally. Requires Pinia to be
 * initialized (which it always is post-main.ts boot).
 */
export function translateAuthError(error: AuthError | null): string {
  if (!error) return ''
  const store = useLanguageStore()
  const key = codeToKey[error.code as keyof typeof codeToKey]
  return key ? store.t.shared.authErrors[key] : error.message
}

/**
 * Convenience wrapper: try the locale-mapped auth message first,
 * then fall back to the generic handleError pipeline.
 */
export function handleAuthError(error: AuthError | unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const translated = translateAuthError(error as AuthError)
    if (translated) return translated
  }
  return handleError(error, 'unknown')
}
