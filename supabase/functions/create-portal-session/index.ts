import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await getAuthenticatedUser(req)

    // Construct return URL server-side to prevent open redirect attacks
    const appUrl = Deno.env.get('APP_URL')
    if (!appUrl) {
      return errorResponse('Server misconfiguration: APP_URL not set', 500)
    }
    const returnUrl = `${appUrl}/parent/subscription`

    // Get Stripe customer ID
    const { data: parentProfile } = await supabaseAdmin
      .from('parent_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!parentProfile?.stripe_customer_id) {
      return errorResponse('No billing account found', 404)
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: parentProfile.stripe_customer_id,
      return_url: returnUrl,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof Response) return error
    return errorResponse('Failed to open billing portal', 500, error)
  }
})
