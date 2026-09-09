// APP_URL is the comma-separated allowlist of origins permitted to call these
// functions (e.g. the deployed app plus http://localhost:5173 for local dev).
// Fail fast at module load if it is unset or empty, instead of degrading to an
// allowlist that matches nothing and produces opaque browser CORS failures.
const allowedOrigins = new Set(
  (Deno.env.get('APP_URL') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

if (allowedOrigins.size === 0) {
  throw new Error('Missing required env APP_URL')
}

/**
 * CORS headers for one request.
 *
 * The allowlist holds more than one origin, so `Access-Control-Allow-Origin`
 * echoes the request's own `Origin` rather than naming a fixed value — a
 * response may only ever advertise a single origin. An origin outside the
 * allowlist gets no `Access-Control-Allow-Origin` at all, which is what makes
 * the browser block it. `Vary: Origin` keeps caches from serving one origin's
 * response to another.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }

  const origin = req.headers.get('Origin')
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

/** JSON response carrying this request's CORS headers. */
export function jsonResponse(req: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

/**
 * Create a sanitized error JSON response.
 * Logs the full error server-side but returns a generic message to the client.
 */
export function errorResponse(
  req: Request,
  message: string,
  status: number,
  error?: unknown,
): Response {
  if (error) {
    console.error(message, error)
  }
  return jsonResponse(req, { error: message }, status)
}
