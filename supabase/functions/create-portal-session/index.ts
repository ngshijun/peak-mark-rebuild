import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Construct return URL server-side to prevent open redirect attacks
    // TODO: Set APP_URL as a Supabase secret once the final production domain is decided
    const appUrl = Deno.env.get('APP_URL') || req.headers.get('origin') || 'http://localhost:5173'
    const returnUrl = `${appUrl}/parent/subscription`

    // Get Stripe customer ID
    const { data: parentProfile } = await supabaseAdmin
      .from('parent_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!parentProfile?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'No billing account found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: parentProfile.stripe_customer_id,
      return_url: returnUrl,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return errorResponse('Failed to open billing portal', 500, error)
  }
})
