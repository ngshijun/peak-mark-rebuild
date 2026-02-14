import { AuthError, type PostgrestError } from '@supabase/supabase-js'

/**
 * Centralized error handler for Supabase and general errors.
 *
 * Classifies errors by type using error codes (not message strings) and
 * returns a safe, user-friendly message. Raw error details are logged
 * via console.error for debugging.
 *
 * @param err - The error to handle (unknown type from catch blocks)
 * @param fallback - A domain-specific fallback message (e.g., "Failed to load questions.")
 * @returns A user-friendly error string
 */
export function handleError(err: unknown, fallback: string): string {
  console.error('[Error]', err)

  // ── Auth errors (from @supabase/supabase-js) ──
  if (err instanceof AuthError) {
    return mapAuthError(err)
  }

  // ── Postgrest / database errors ──
  if (isPostgrestError(err)) {
    return mapPostgrestError(err)
  }

  // ── Storage errors (duck-typed via __isStorageError) ──
  if (isStorageError(err)) {
    return mapStorageError(err)
  }

  // ── Functions errors ──
  if (isFunctionsError(err)) {
    return fallback
  }

  // ── Network errors (fetch failures) ──
  if (err instanceof TypeError && isFetchError(err.message)) {
    return 'Unable to connect. Please check your internet connection and try again.'
  }

  return fallback
}

// ──────────────────────────────────────────────
// Auth error mapping
// ──────────────────────────────────────────────

function mapAuthError(err: AuthError): string {
  // Map by error code first (most reliable)
  if (err.code) {
    switch (err.code) {
      case 'invalid_credentials':
        return 'Invalid email or password. Please try again.'
      case 'email_not_confirmed':
        return 'Please check your email and confirm your account before signing in.'
      case 'user_already_exists':
        return 'An account with this email already exists.'
      case 'weak_password':
        return 'Password is too weak. Please use a stronger password.'
      case 'session_not_found':
        return 'Your session has expired. Please sign in again.'
      case 'over_request_rate_limit':
        return 'Too many requests. Please wait a moment and try again.'
      case 'same_password':
        return 'New password must be different from your current password.'
      case 'user_not_found':
        return 'No account found with this email address.'
      case 'email_exists':
        return 'An account with this email already exists.'
      case 'otp_expired':
        return 'The verification code has expired. Please request a new one.'
      case 'validation_failed':
        return 'Please check your input and try again.'
    }
  }

  // Fallback on HTTP status
  switch (err.status) {
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return 'You do not have permission to perform this action.'
    case 422:
      return 'Please check your input and try again.'
    case 429:
      return 'Too many requests. Please wait a moment and try again.'
  }

  return 'An authentication error occurred. Please try again.'
}

// ──────────────────────────────────────────────
// Postgrest / database error mapping
// ──────────────────────────────────────────────

function isPostgrestError(err: unknown): err is PostgrestError {
  if (typeof err !== 'object' || err === null) return false
  return 'code' in err && 'message' in err && 'details' in err
}

function mapPostgrestError(err: PostgrestError): string {
  // PostgreSQL error codes
  switch (err.code) {
    // Unique violation (e.g., duplicate email, duplicate key)
    case '23505':
      return 'This record already exists. Please check for duplicates.'
    // Foreign key violation
    case '23503':
      return 'This action cannot be completed because it references data that no longer exists.'
    // NOT NULL violation
    case '23502':
      return 'A required field is missing. Please fill in all required fields.'
    // Check constraint violation
    case '23514':
      return 'The provided value is not valid. Please check your input.'
    // Insufficient privilege / RLS violation
    case '42501':
      return 'You do not have permission to perform this action.'
    // Undefined table
    case '42P01':
      return 'Something went wrong. Please try again later.'
    // Undefined column
    case '42703':
      return 'Something went wrong. Please try again later.'
    // Raise exception from PL/pgSQL (custom trigger/RPC error messages)
    case 'P0001':
      return err.message || 'This action could not be completed. Please try again.'
  }

  // PostgREST-specific codes (PGRST prefix)
  if (err.code?.startsWith('PGRST')) {
    switch (err.code) {
      case 'PGRST116': // "The result contains 0 rows" (expected exactly one)
        return 'The requested record was not found.'
      default:
        return 'Something went wrong. Please try again later.'
    }
  }

  return 'A database error occurred. Please try again.'
}

// ──────────────────────────────────────────────
// Storage error mapping (duck-typed)
// ──────────────────────────────────────────────

interface StorageErrorLike {
  __isStorageError: true
  message: string
  status?: number
  statusCode?: string
}

function isStorageError(err: unknown): err is StorageErrorLike {
  if (typeof err !== 'object' || err === null) return false
  return '__isStorageError' in err && (err as StorageErrorLike).__isStorageError === true
}

function mapStorageError(err: StorageErrorLike): string {
  const status = err.status ?? (err.statusCode ? parseInt(err.statusCode) : 0)

  switch (status) {
    case 413:
      return 'The file is too large. Please choose a smaller file.'
    case 415:
      return 'This file type is not supported. Please use a different format.'
    case 404:
      return 'The file was not found.'
    case 403:
      return 'You do not have permission to access this file.'
  }

  return 'Failed to process the file. Please try again.'
}

// ──────────────────────────────────────────────
// Functions error detection
// ──────────────────────────────────────────────

function isFunctionsError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  // FunctionsError types: FunctionsHttpError, FunctionsRelayError, FunctionsFetchError
  const name = (err as { name?: string }).name
  return typeof name === 'string' && name.startsWith('Functions')
}

// ──────────────────────────────────────────────
// Network error detection
// ──────────────────────────────────────────────

function isFetchError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  )
}
