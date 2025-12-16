import type Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Syncs a Stripe subscription object to the child_subscriptions table.
 * This is the single source of truth for subscription sync logic.
 * Used by:
 * - Webhook handlers (backup/reconciliation)
 * - Direct API responses (immediate sync)
 * - Manual sync operations
 */
export async function syncSubscriptionToDatabase(
  subscription: Stripe.Subscription,
  supabaseAdmin: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const parentId = subscription.metadata.supabase_parent_id
  const studentId = subscription.metadata.supabase_student_id

  if (!parentId || !studentId) {
    // Try to find by stripe_subscription_id as fallback
    const { data: existingSub } = await supabaseAdmin
      .from('child_subscriptions')
      .select('parent_id, student_id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    if (!existingSub) {
      return {
        success: false,
        error: `Missing metadata in subscription ${subscription.id} and no existing record found`,
      }
    }

    // Use existing record's IDs
    return syncWithIds(subscription, existingSub.parent_id, existingSub.student_id, supabaseAdmin)
  }

  return syncWithIds(subscription, parentId, studentId, supabaseAdmin)
}

async function syncWithIds(
  subscription: Stripe.Subscription,
  parentId: string,
  studentId: string,
  supabaseAdmin: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const priceId = subscription.items.data[0]?.price.id

  // Get tier from price ID
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('stripe_price_id', priceId)
    .single()

  const tier = plan?.id || 'basic'
  const isActive = ['active', 'trialing'].includes(subscription.status)

  // Convert Unix timestamps to ISO strings
  const currentPeriodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null
  const startDate = subscription.start_date
    ? new Date(subscription.start_date * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  // next_billing_date is the end of current period (when next charge happens)
  // unless subscription is set to cancel at period end
  const nextBillingDate =
    subscription.cancel_at_period_end || !subscription.current_period_end
      ? null
      : new Date(subscription.current_period_end * 1000).toISOString().split('T')[0]

  // Upsert child subscription
  const { error } = await supabaseAdmin
    .from('child_subscriptions')
    .upsert(
      {
        parent_id: parentId,
        student_id: studentId,
        tier: tier,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        stripe_status: subscription.status,
        is_active: isActive,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end,
        start_date: startDate,
        next_billing_date: nextBillingDate,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'student_id',
      }
    )

  if (error) {
    console.error('Error syncing subscription to database:', error)
    return { success: false, error: error.message }
  }

  console.log(
    `Subscription ${subscription.id} synced for student ${studentId}, tier: ${tier}, status: ${subscription.status}`
  )
  return { success: true }
}

/**
 * Syncs subscription data when it's been deleted/cancelled in Stripe.
 * Downgrades to basic tier while keeping the record active.
 */
export async function syncSubscriptionDeletion(
  subscriptionId: string,
  supabaseAdmin: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('child_subscriptions')
    .update({
      tier: 'basic',
      stripe_subscription_id: null,
      stripe_price_id: null,
      stripe_status: 'canceled',
      is_active: true, // Keep active on basic tier
      cancel_at_period_end: false,
      current_period_start: null,
      current_period_end: null,
      next_billing_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('Error syncing subscription deletion:', error)
    return { success: false, error: error.message }
  }

  console.log(`Subscription ${subscriptionId} deleted, downgraded to basic`)
  return { success: true }
}
