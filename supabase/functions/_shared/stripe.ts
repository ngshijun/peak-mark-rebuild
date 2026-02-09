import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-12-18.acacia',
  httpClient: Stripe.createFetchHttpClient(),
})

export const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const allowedOrigin = Deno.env.get('APP_URL') || '*'

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Create a sanitized error JSON response.
 * Logs the full error server-side but returns a generic message to the client.
 */
export function errorResponse(
  message: string,
  status: number,
  error?: unknown
): Response {
  if (error) {
    console.error(message, error)
  }
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
