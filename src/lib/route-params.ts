import { z } from 'zod'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

const uuidSchema = z.string().uuid()

/**
 * Read a required UUID route param (e.g. `:studentId` in a `/parent/child/:studentId/session/:sessionId`).
 * Throws if the param is missing or not a valid UUID — callers are expected
 * to invoke this inside a `computed()` or onMounted block where a bad URL
 * should fall through to the router's 404 path.
 *
 * RLS is the real access-control defence; this just closes the
 * consistency gap with lib/validations.ts and keeps malformed IDs out of
 * downstream joins and logs.
 */
export function requireUuidParam(route: RouteLocationNormalizedLoaded, key: string): string {
  const raw = route.params[key]
  const parsed = uuidSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid route param "${key}": expected UUID, got ${JSON.stringify(raw)}`)
  }
  return parsed.data
}

/**
 * Read an optional UUID query parameter. Returns null if missing or not a
 * valid UUID — quiz resume URLs and similar flows treat "no sessionId" as
 * "start fresh", so a bad value should degrade to the same path.
 */
export function optionalUuidQuery(
  route: RouteLocationNormalizedLoaded,
  key: string,
): string | null {
  const raw = route.query[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  const parsed = uuidSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Read an optional string query parameter. Returns null if missing or
 * not a single string (e.g. Vue Router can surface repeated `?x=1&x=2`
 * as an array). No shape validation beyond "is a string".
 */
export function optionalStringQuery(
  route: RouteLocationNormalizedLoaded,
  key: string,
): string | null {
  const raw = route.query[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.length > 0 ? value : null
}
