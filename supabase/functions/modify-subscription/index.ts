import '@supabase/functions-js/edge-runtime.d.ts'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import {
  syncSubscriptionToDatabase,
  resolveSubscriptionChange,
  extractPeriodDates,
} from '../_shared/sync-helpers.ts'
import type Stripe from 'stripe'
import { getAuthenticatedUser, verifyParentStudentLink } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await getAuthenticatedUser(req)

    const { studentId, newPriceId } = await req.json()

    if (!studentId || !newPriceId) {
      return errorResponse('Missing required fields', 400)
    }

    const {
      subscription,
      stripeSubscription,
      currentPriceId,
      isUpgrade,
    } = await resolveSubscriptionChange(
      user.id,
      studentId,
      newPriceId,
      supabaseAdmin,
      stripe,
      errorResponse,
      verifyParentStudentLink,
      ['items.data.price', 'schedule', 'latest_invoice'],
    )

    let updatedSubscription: Stripe.Subscription

    if (isUpgrade) {
      // UPGRADE: Pay prorated difference immediately and reset billing cycle
      // If there's an existing schedule, release it first
      if (stripeSubscription.schedule) {
        const scheduleId =
          typeof stripeSubscription.schedule === 'string'
            ? stripeSubscription.schedule
            : stripeSubscription.schedule.id
        await stripe.subscriptionSchedules.release(scheduleId)
      }

      updatedSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price: newPriceId,
            },
          ],
          // Reset billing cycle to now - starts a new subscription period
          billing_cycle_anchor: 'now',
          // Immediately invoice the prorated difference
          proration_behavior: 'always_invoice',
          // Ensure payment is attempted immediately
          payment_behavior: 'error_if_incomplete',
          expand: ['latest_invoice'],
        }
      )

      // Immediately sync the updated subscription state to database
      await syncSubscriptionToDatabase(updatedSubscription, supabaseAdmin)

      // Clear any scheduled downgrade since we're upgrading now
      await supabaseAdmin
        .from('child_subscriptions')
        .update({
          scheduled_tier: null,
          scheduled_change_date: null,
          stripe_schedule_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.stripe_subscription_id)

      const upgradePeriod = extractPeriodDates(updatedSubscription)
      return new Response(
        JSON.stringify({
          success: true,
          type: 'immediate',
          message: 'Upgrade applied immediately. You have been charged the prorated difference and your new billing cycle starts today.',
          subscription: {
            id: updatedSubscription.id,
            status: updatedSubscription.status,
            currentPeriodStart: upgradePeriod.periodStart
              ? new Date(upgradePeriod.periodStart * 1000).toISOString()
              : null,
            currentPeriodEnd: upgradePeriod.periodEnd
              ? new Date(upgradePeriod.periodEnd * 1000).toISOString()
              : null,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else {
      // DOWNGRADE: Schedule change for next billing cycle
      const { periodStart, periodEnd } = extractPeriodDates(stripeSubscription)

      if (!periodStart || !periodEnd) {
        return errorResponse('Cannot determine current billing period', 500)
      }

      let schedule: Stripe.SubscriptionSchedule

      if (stripeSubscription.schedule) {
        // Update existing schedule
        const scheduleId =
          typeof stripeSubscription.schedule === 'string'
            ? stripeSubscription.schedule
            : stripeSubscription.schedule.id

        schedule = await stripe.subscriptionSchedules.update(scheduleId, {
          phases: [
            {
              items: [{ price: currentPriceId, quantity: 1 }],
              start_date: periodStart,
              end_date: periodEnd,
            },
            {
              items: [{ price: newPriceId, quantity: 1 }],
              start_date: periodEnd,
            },
          ],
          end_behavior: 'release',
        })
      } else {
        // Create a new schedule from the existing subscription
        schedule = await stripe.subscriptionSchedules.create({
          from_subscription: subscription.stripe_subscription_id,
        })

        // Update the schedule with two phases:
        // Phase 1: Current price until period end
        // Phase 2: New (lower) price from period end onwards
        schedule = await stripe.subscriptionSchedules.update(schedule.id, {
          phases: [
            {
              items: [{ price: currentPriceId, quantity: 1 }],
              start_date: periodStart,
              end_date: periodEnd,
            },
            {
              items: [{ price: newPriceId, quantity: 1 }],
              start_date: periodEnd,
            },
          ],
          end_behavior: 'release',
        })
      }

      // Get the updated subscription (it now has a schedule attached)
      updatedSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id,
        { expand: ['latest_invoice'] }
      )

      // Sync current state (tier stays the same until period end)
      await syncSubscriptionToDatabase(updatedSubscription, supabaseAdmin)

      // Get the new tier info for response and database
      const { data: newPlan } = await supabaseAdmin
        .from('subscription_plans')
        .select('id, name')
        .eq('stripe_price_id', newPriceId)
        .single()

      // Save scheduled downgrade info to database
      const scheduledDate = new Date(periodEnd * 1000).toISOString()
      await supabaseAdmin
        .from('child_subscriptions')
        .update({
          scheduled_tier: newPlan?.id || null,
          scheduled_change_date: scheduledDate,
          stripe_schedule_id: schedule.id,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.stripe_subscription_id)

      const downgradePeriod = extractPeriodDates(updatedSubscription)
      return new Response(
        JSON.stringify({
          success: true,
          type: 'scheduled',
          message: `Downgrade to ${newPlan?.name || 'new plan'} scheduled for next billing cycle`,
          scheduledDate,
          scheduleId: schedule.id,
          scheduledTier: newPlan?.id,
          subscription: {
            id: updatedSubscription.id,
            status: updatedSubscription.status,
            currentPeriodEnd: downgradePeriod.periodEnd
              ? new Date(downgradePeriod.periodEnd * 1000).toISOString()
              : null,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    if (error instanceof Response) return error
    return errorResponse('Failed to modify subscription', 500, error)
  }
})
