import '@supabase/functions-js/edge-runtime.d.ts'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { syncSubscriptionToDatabase, extractStripeId } from '../_shared/sync-helpers.ts'
import { getAuthenticatedUser, verifyParent, verifyParentStudentLink } from '../_shared/auth.ts'

/**
 * Reverse a pending subscription change so the subscription stays on its
 * current plan at renewal. Two mutually exclusive states are handled:
 *
 *   1. A subscription schedule is attached (scheduled downgrade) →
 *      release it via `subscriptionSchedules.release`. The subscription
 *      continues renewing at the current price.
 *
 *   2. `cancel_at_period_end` is true (pending cancellation) →
 *      set it back to false via `subscriptions.update`. The subscription
 *      continues renewing instead of being canceled at period end.
 *
 * These states are mutually exclusive by design — `cancel-subscription`
 * releases any schedule before setting cancel_at_period_end, and
 * `modify-subscription` releases any schedule before starting an upgrade.
 * If neither state is active, this endpoint is a no-op and returns success.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await getAuthenticatedUser(req)
    await verifyParent(user.id)

    const { studentId } = await req.json()
    if (!studentId) {
      return errorResponse('Missing studentId', 400)
    }

    await verifyParentStudentLink(user.id, studentId)

    const { data: subscription } = await supabaseAdmin
      .from('child_subscriptions')
      .select('stripe_subscription_id')
      .eq('student_id', studentId)
      .eq('parent_id', user.id)
      .single()

    if (!subscription?.stripe_subscription_id) {
      return errorResponse('No active subscription found', 404)
    }

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)

    const scheduleId = extractStripeId(stripeSub.schedule)
    if (scheduleId) {
      await stripe.subscriptionSchedules.release(scheduleId)
    } else if (stripeSub.cancel_at_period_end) {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: false,
      })
    }
    // else: nothing pending — no-op.

    // Sync the post-reversal state so the UI reflects reality without waiting
    // for the webhook to land.
    const updatedSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
      expand: ['latest_invoice'],
    })
    await syncSubscriptionToDatabase(updatedSub, supabaseAdmin)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof Response) return error
    return errorResponse('Failed to keep current plan', 500, error)
  }
})
