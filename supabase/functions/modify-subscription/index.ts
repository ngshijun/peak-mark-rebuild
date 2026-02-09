import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { stripe, corsHeaders, errorResponse } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { syncSubscriptionToDatabase } from '../_shared/sync-helpers.ts'
import type Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'

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

    const { studentId, newPriceId } = await req.json()

    if (!studentId || !newPriceId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
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

    // Get current subscription
    const { data: subscription } = await supabaseAdmin
      .from('child_subscriptions')
      .select('stripe_subscription_id')
      .eq('student_id', studentId)
      .eq('parent_id', user.id)
      .single()

    if (!subscription?.stripe_subscription_id) {
      return new Response(JSON.stringify({ error: 'No active subscription found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Retrieve the current subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id,
      { expand: ['items.data.price', 'schedule'] }
    )

    const currentPriceId = stripeSubscription.items.data[0]?.price.id
    if (currentPriceId === newPriceId) {
      return new Response(JSON.stringify({ error: 'Already on this plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get price amounts to determine upgrade vs downgrade
    const [currentPrice, newPrice] = await Promise.all([
      stripe.prices.retrieve(currentPriceId),
      stripe.prices.retrieve(newPriceId),
    ])

    const currentAmount = currentPrice.unit_amount ?? 0
    const newAmount = newPrice.unit_amount ?? 0
    const isUpgrade = newAmount > currentAmount

    let updatedSubscription: Stripe.Subscription

    if (isUpgrade) {
      // UPGRADE: Pay prorated difference immediately and reset billing cycle
      // Similar to Claude's subscription behavior
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

      return new Response(
        JSON.stringify({
          success: true,
          type: 'immediate',
          message: 'Upgrade applied immediately. You have been charged the prorated difference and your new billing cycle starts today.',
          subscription: {
            id: updatedSubscription.id,
            status: updatedSubscription.status,
            currentPeriodStart: new Date(
              updatedSubscription.current_period_start * 1000
            ).toISOString(),
            currentPeriodEnd: new Date(
              updatedSubscription.current_period_end * 1000
            ).toISOString(),
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else {
      // DOWNGRADE: Schedule change for next billing cycle
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
              start_date: stripeSubscription.current_period_start,
              end_date: stripeSubscription.current_period_end,
            },
            {
              items: [{ price: newPriceId, quantity: 1 }],
              start_date: stripeSubscription.current_period_end,
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
              start_date: stripeSubscription.current_period_start,
              end_date: stripeSubscription.current_period_end,
            },
            {
              items: [{ price: newPriceId, quantity: 1 }],
              start_date: stripeSubscription.current_period_end,
            },
          ],
          end_behavior: 'release',
        })
      }

      // Get the updated subscription (it now has a schedule attached)
      updatedSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id
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
      const scheduledDate = new Date(stripeSubscription.current_period_end * 1000).toISOString()
      await supabaseAdmin
        .from('child_subscriptions')
        .update({
          scheduled_tier: newPlan?.id || null,
          scheduled_change_date: scheduledDate,
          stripe_schedule_id: schedule.id,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.stripe_subscription_id)

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
            currentPeriodEnd: new Date(
              updatedSubscription.current_period_end * 1000
            ).toISOString(),
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    return errorResponse('Failed to modify subscription', 500, error)
  }
})
