import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { syncSubscriptionToDatabase } from '../_shared/sync-helpers.ts'

/**
 * Sync Subscription Edge Function
 *
 * Fetches the current subscription state from Stripe and syncs to database.
 * Used for:
 * - After checkout redirect (verify payment succeeded)
 * - Manual reconciliation
 * - When webhook may have failed
 */
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

    const { studentId, sessionId } = await req.json()

    if (!studentId) {
      return new Response(JSON.stringify({ error: 'Missing studentId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify parent-student link
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

    let stripeSubscriptionId: string | null = null

    // If sessionId is provided (from checkout redirect), get subscription from session
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      })

      if (session.payment_status !== 'paid') {
        return new Response(
          JSON.stringify({
            error: 'Payment not completed',
            paymentStatus: session.payment_status,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      if (session.subscription) {
        stripeSubscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      }
    }

    // If no sessionId, try to get subscription from database
    if (!stripeSubscriptionId) {
      const { data: existingSub } = await supabaseAdmin
        .from('child_subscriptions')
        .select('stripe_subscription_id')
        .eq('student_id', studentId)
        .eq('parent_id', user.id)
        .single()

      stripeSubscriptionId = existingSub?.stripe_subscription_id || null
    }

    if (!stripeSubscriptionId) {
      return new Response(
        JSON.stringify({
          error: 'No subscription found for this student',
          synced: false,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Fetch current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

    // Ensure metadata has parent/student IDs for sync
    if (!subscription.metadata.supabase_parent_id || !subscription.metadata.supabase_student_id) {
      // Update Stripe subscription with metadata if missing
      await stripe.subscriptions.update(stripeSubscriptionId, {
        metadata: {
          supabase_parent_id: user.id,
          supabase_student_id: studentId,
        },
      })
      // Re-fetch with updated metadata
      subscription.metadata.supabase_parent_id = user.id
      subscription.metadata.supabase_student_id = studentId
    }

    // Sync to database using shared helper
    const syncResult = await syncSubscriptionToDatabase(subscription, supabaseAdmin)

    if (!syncResult.success) {
      return new Response(
        JSON.stringify({
          error: syncResult.error,
          synced: false,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Return synced subscription data
    return new Response(
      JSON.stringify({
        synced: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error syncing subscription:', error)
    return new Response(JSON.stringify({ error: 'Failed to sync subscription', synced: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
