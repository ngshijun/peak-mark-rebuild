import '@supabase/functions-js/edge-runtime.d.ts'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import {
  syncSubscriptionToDatabase,
  syncSubscriptionDeletion,
  extractStripeId,
} from '../_shared/sync-helpers.ts'
import { getAuthenticatedUser, verifyParent, verifyParentStudentLink } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await getAuthenticatedUser(req)
    await verifyParent(user.id)

    const { studentId, cancelImmediately = false } = await req.json()

    if (!studentId) {
      return errorResponse('Missing studentId', 400)
    }

    await verifyParentStudentLink(user.id, studentId)

    // Get current subscription
    const { data: subscription } = await supabaseAdmin
      .from('child_subscriptions')
      .select('stripe_subscription_id')
      .eq('student_id', studentId)
      .eq('parent_id', user.id)
      .single()

    if (!subscription?.stripe_subscription_id) {
      return errorResponse('No active subscription found', 404)
    }

    if (cancelImmediately) {
      // Cancel immediately - subscription is deleted in Stripe.
      // Stripe auto-releases any attached schedule when the subscription
      // is canceled, so no separate release call is needed here.
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
      // Sync deletion to database (downgrades to core)
      await syncSubscriptionDeletion(subscription.stripe_subscription_id, supabaseAdmin)
    } else {
      // If a schedule is attached (i.e., a scheduled downgrade is pending),
      // release it first. Otherwise the schedule's phase transition at
      // period end would fight with cancel_at_period_end and leave the
      // subscription in an ambiguous state (e.g., Plus for one extra
      // billing cycle before canceling, which is not what the user asked).
      const stripeSub = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id,
      )
      const scheduleId = extractStripeId(stripeSub.schedule)
      if (scheduleId) {
        await stripe.subscriptionSchedules.release(scheduleId)
      }

      // Cancel at period end - subscription remains active until period ends
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: true,
          expand: ['latest_invoice'],
        }
      )
      // Immediately sync the updated subscription state to database
      await syncSubscriptionToDatabase(updatedSubscription, supabaseAdmin)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof Response) return error
    return errorResponse('Failed to cancel subscription', 500, error)
  }
})
