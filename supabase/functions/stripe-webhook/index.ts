import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { stripe, WEBHOOK_SECRET, corsHeaders } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import {
  syncSubscriptionToDatabase,
  syncSubscriptionDeletion,
} from '../_shared/sync-helpers.ts'
import type Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'

/**
 * Check if a webhook event has already been processed (idempotency).
 * Returns true if the event was already processed and should be skipped.
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('processed_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .single()
  return !!data
}

/**
 * Mark a webhook event as processed.
 */
async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('processed_webhook_events')
    .insert({ event_id: eventId, event_type: eventType })
  if (error) {
    // Unique constraint violation means another instance already processed it - safe to ignore
    if (error.code !== '23505') {
      console.error('Error marking event as processed:', error)
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET)

    console.log(`Processing webhook event: ${event.type}, ID: ${event.id}`)

    // Idempotency check: skip if already processed
    if (await isEventProcessed(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`)
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark event as processed after successful handling
    await markEventProcessed(event.id, event.type)

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Webhook processing failed', { status: 400 })
  }
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return

  const parentId = session.metadata?.supabase_parent_id
  const studentId = session.metadata?.supabase_student_id

  if (!parentId || !studentId) {
    console.error('Missing metadata in checkout session')
    return
  }

  // Subscription details will be synced via subscription.created webhook
  console.log(`Checkout completed for parent ${parentId}, student ${studentId}`)
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  // Use the shared sync helper for consistent sync logic
  const result = await syncSubscriptionToDatabase(subscription, supabaseAdmin)
  if (!result.success) {
    console.error('Error in handleSubscriptionUpdate:', result.error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Use the shared sync helper for consistent deletion logic
  const result = await syncSubscriptionDeletion(subscription.id, supabaseAdmin)
  if (!result.success) {
    console.error('Error in handleSubscriptionDeleted:', result.error)
  }
}

async function handleInvoicePaid(invoiceFromWebhook: Stripe.Invoice): Promise<{ success: boolean; step: string; error?: string }> {
  console.log(`handleInvoicePaid called for invoice ${invoiceFromWebhook.id}`)
  console.log(`Invoice subscription field: ${invoiceFromWebhook.subscription}`)

  // Use webhook data first, but may need to fetch full invoice from API
  let invoice = invoiceFromWebhook
  let subscriptionId = invoice.subscription as string | null

  if (!subscriptionId && invoice.lines?.data?.[0]?.subscription) {
    subscriptionId = invoice.lines.data[0].subscription as string
    console.log(`Got subscription from line item: ${subscriptionId}`)
  }

  // If still no subscription ID, fetch the full invoice from Stripe API
  if (!subscriptionId) {
    console.log('No subscription in webhook payload, fetching full invoice from Stripe API')
    invoice = await stripe.invoices.retrieve(invoiceFromWebhook.id, {
      expand: ['lines.data.price'],
    })
    subscriptionId = invoice.subscription as string | null
    console.log(`Got subscription from API: ${subscriptionId}`)

    if (!subscriptionId && invoice.lines?.data?.[0]?.subscription) {
      subscriptionId = invoice.lines.data[0].subscription as string
      console.log(`Got subscription from API line item: ${subscriptionId}`)
    }
  }

  if (!subscriptionId) {
    console.log('No subscription on invoice even after API fetch')
    return { success: false, step: 'get_subscription_id', error: 'No subscription ID found on invoice or line items' }
  }

  console.log(`Using subscription ID: ${subscriptionId}`)

  // Fetch subscription to get metadata
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  console.log(`Subscription ${subscription.id} metadata:`, JSON.stringify(subscription.metadata))

  let parentId = subscription.metadata.supabase_parent_id
  let studentId = subscription.metadata.supabase_student_id

  // Fallback: look up from existing child_subscriptions record
  if (!parentId || !studentId) {
    console.log(`Metadata missing, trying fallback lookup for subscription ${subscription.id}`)
    const { data: existingSub, error: lookupError } = await supabaseAdmin
      .from('child_subscriptions')
      .select('parent_id, student_id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    console.log(`Fallback lookup result:`, existingSub, lookupError)

    if (existingSub) {
      parentId = existingSub.parent_id
      studentId = existingSub.student_id
      console.log(`Using fallback IDs: parent=${parentId}, student=${studentId}`)
    }
  }

  if (!parentId) {
    console.error(`Missing parent_id for invoice ${invoice.id}, subscription ${subscription.id}`)
    return { success: false, step: 'get_parent_id', error: `No parent_id found for subscription ${subscription.id}` }
  }

  console.log(`Proceeding to insert payment for parent=${parentId}, student=${studentId}`)

  // Get tier from subscription's price (more reliable than invoice line items)
  const priceId = subscription.items.data[0]?.price?.id || invoice.lines?.data?.[0]?.price?.id
  console.log(`Looking up tier for price: ${priceId}`)
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('stripe_price_id', priceId)
    .single()
  console.log(`Found plan: ${plan?.id || 'none'}`)

  // Record payment
  const { error } = await supabaseAdmin.from('payment_history').insert({
    parent_id: parentId,
    student_id: studentId || null,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: (invoice.payment_intent as string) || null,
    stripe_subscription_id: subscriptionId,
    amount_cents: invoice.amount_paid,
    currency: invoice.currency,
    status: 'succeeded',
    tier: plan?.id || null,
    description: invoice.lines?.data?.[0]?.description || 'Subscription payment',
    metadata: {
      invoice_number: invoice.number,
      billing_reason: invoice.billing_reason,
    },
  })

  if (error) {
    console.error('Error recording payment:', JSON.stringify(error))
    return { success: false, step: 'insert_payment', error: error.message }
  } else {
    console.log(`Payment recorded successfully for invoice ${invoice.id}`)
    return { success: true, step: 'complete' }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Try to get subscription ID from invoice or from line items
  let subscriptionId = invoice.subscription as string | null
  if (!subscriptionId && invoice.lines?.data?.[0]?.subscription) {
    subscriptionId = invoice.lines.data[0].subscription as string
  }
  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  let parentId = subscription.metadata.supabase_parent_id
  let studentId = subscription.metadata.supabase_student_id

  // Fallback: look up from existing child_subscriptions record
  if (!parentId || !studentId) {
    const { data: existingSub } = await supabaseAdmin
      .from('child_subscriptions')
      .select('parent_id, student_id')
      .eq('stripe_subscription_id', subscription.id)
      .single()

    if (existingSub) {
      parentId = existingSub.parent_id
      studentId = existingSub.student_id
    }
  }

  if (!parentId) {
    console.error(`Missing parent_id for failed payment, invoice ${invoice.id}`)
    return
  }

  // Record failed payment
  const { error } = await supabaseAdmin.from('payment_history').insert({
    parent_id: parentId,
    student_id: studentId || null,
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: subscriptionId,
    amount_cents: invoice.amount_due,
    currency: invoice.currency,
    status: 'failed',
    description: 'Payment failed',
    metadata: {
      invoice_number: invoice.number,
      attempt_count: invoice.attempt_count,
    },
  })

  if (error) {
    console.error('Error recording failed payment:', error)
  } else {
    console.log(`Payment failed recorded for invoice ${invoice.id}`)
  }
}
