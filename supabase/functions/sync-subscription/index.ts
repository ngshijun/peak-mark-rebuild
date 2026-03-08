import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { syncSubscriptionToDatabase } from '../_shared/sync-helpers.ts'
import { getAuthenticatedUser, verifyParentStudentLink } from '../_shared/auth.ts'

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
    const user = await getAuthenticatedUser(req)

    const { studentId, sessionId } = await req.json()

    if (!studentId) {
      return errorResponse('Missing studentId', 400)
    }

    await verifyParentStudentLink(user.id, studentId)

    let stripeSubscriptionId: string | null = null

    // If sessionId is provided (from checkout redirect), get subscription from session
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      })

      if (session.payment_status !== 'paid') {
        return errorResponse('Payment not completed', 400)
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
      return errorResponse('No subscription found for this student', 404)
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
      return errorResponse(syncResult.error || 'Sync failed', 500)
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
    if (error instanceof Response) return error
    return errorResponse('Failed to sync subscription', 500, error)
  }
})
