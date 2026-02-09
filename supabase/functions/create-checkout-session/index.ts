import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

interface RequestBody {
  priceId: string
  studentId: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user authentication
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

    // Verify user is a parent
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (profile?.user_type !== 'parent') {
      return new Response(JSON.stringify({ error: 'Only parents can create subscriptions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { priceId, studentId }: RequestBody = await req.json()

    if (!priceId || !studentId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Construct redirect URLs server-side to prevent open redirect attacks
    // TODO: Set APP_URL as a Supabase secret once the final production domain is decided
    const appUrl = Deno.env.get('APP_URL') || req.headers.get('origin') || 'http://localhost:5173'
    const successUrl = `${appUrl}/parent/subscription?success=true`
    const cancelUrl = `${appUrl}/parent/subscription?canceled=true`

    // Verify parent-student link exists
    const { data: link } = await supabaseAdmin
      .from('parent_student_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('student_id', studentId)
      .single()

    if (!link) {
      return new Response(JSON.stringify({ error: 'Student not linked to parent' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get or create Stripe customer
    const { data: parentProfile } = await supabaseAdmin
      .from('parent_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let stripeCustomerId = parentProfile?.stripe_customer_id

    if (!stripeCustomerId) {
      // Create new Stripe customer
      const { data: parentInfo } = await supabaseAdmin
        .from('profiles')
        .select('name, email')
        .eq('id', user.id)
        .single()

      const customer = await stripe.customers.create({
        email: parentInfo?.email ?? undefined,
        name: parentInfo?.name ?? undefined,
        metadata: {
          supabase_parent_id: user.id,
        },
      })

      stripeCustomerId = customer.id

      // Save Stripe customer ID
      await supabaseAdmin
        .from('parent_profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id)
    }

    // Check for existing active Stripe subscription for this student
    const { data: existingSubscription } = await supabaseAdmin
      .from('child_subscriptions')
      .select('stripe_subscription_id, tier')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .single()

    if (existingSubscription?.stripe_subscription_id) {
      // Student already has active Stripe subscription - use modify instead
      return new Response(
        JSON.stringify({
          error: 'Student already has an active subscription. Use modify subscription instead.',
          hasActiveSubscription: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get student name for description
    const { data: studentInfo } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', studentId)
      .single()

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          supabase_parent_id: user.id,
          supabase_student_id: studentId,
          student_name: studentInfo?.name || 'Unknown',
        },
      },
      metadata: {
        supabase_parent_id: user.id,
        supabase_student_id: studentId,
      },
    })

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return errorResponse('Failed to create checkout session', 500, error)
  }
})
