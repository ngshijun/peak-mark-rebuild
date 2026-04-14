import '@supabase/functions-js/edge-runtime.d.ts'
import { stripe, WEBHOOK_SECRET } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import {
  syncSubscriptionToDatabase,
  syncSubscriptionDeletion,
} from '../_shared/sync-helpers.ts'
import type Stripe from 'stripe'

/**
 * Stripe webhook handler — single entry point for all Stripe → Clavis data sync.
 *
 * ## Idempotency model
 *
 * Stripe delivers webhooks at-least-once. To prevent duplicate processing:
 *
 * 1. After a handler completes successfully, we insert `event.id` into
 *    `processed_webhook_events` (COMMIT pattern). Next time Stripe retries
 *    the same `event.id` — whether via automatic retry or Dashboard "Resend" —
 *    we see the row and skip.
 *
 * 2. If the handler throws, we don't insert. Stripe retries; on the next
 *    delivery we run the handler again from scratch.
 *
 * 3. Domain handlers are designed to be naturally idempotent via state-based
 *    upserts (keyed on `stripe_subscription_id` / `stripe_invoice_id`), so
 *    running them twice is data-safe.
 *
 * Per Stripe's official best practices (docs.stripe.com/webhooks/best-practices):
 * > "You can guard against duplicated event receipts by logging the event IDs
 * >  you've processed, and then not processing already-logged events."
 *
 * ## Operational replay procedure
 *
 * If you ever need to replay a past event to fix drifted data:
 *
 *   1. Find the event in Stripe Dashboard → Developers → Events
 *   2. Delete its log row:
 *        DELETE FROM processed_webhook_events WHERE event_id = 'evt_xxx';
 *   3. Click "Resend" on the event in Stripe Dashboard
 *
 * The handler will re-run with current code. Only do this when you understand
 * what the handler will do — state is overwritten, not merged.
 */

async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('processed_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()
  if (error) {
    console.error('Error checking processed event:', error)
    throw error
  }
  return data !== null
}

async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('processed_webhook_events')
    .insert({ event_id: eventId, event_type: eventType })
  if (error) {
    // Race: another concurrent delivery committed first. Safe — both ran
    // idempotent handlers. Log and move on.
    if (error.code === '23505') {
      console.log(`Event ${eventId} already committed by concurrent delivery`)
      return
    }
    console.error('Error marking event processed:', error)
    throw error
  }
}

Deno.serve(async (req: Request) => {
  // Stripe webhooks are server-to-server — no CORS needed
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET)

    console.log(`Webhook event: ${event.type}, ID: ${event.id}`)

    // Fast-path retry dedup — skip if we already committed this event
    if (await isEventProcessed(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`)
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Dispatch to domain handler
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

    // Commit the event as processed AFTER the handler succeeds.
    // If the handler threw, we never get here — Stripe will retry.
    await markEventProcessed(event.id, event.type)

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Webhook processing failed', { status: 500 })
  }
})

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return

  const parentId = session.metadata?.supabase_parent_id
  const studentId = session.metadata?.supabase_student_id

  if (!parentId || !studentId) {
    throw new Error('Missing metadata in checkout session')
  }

  // Subscription details will be synced via subscription.created webhook
  console.log(`Checkout completed for parent ${parentId}, student ${studentId}`)
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  // Re-fetch with latest_invoice expanded — Clover API removed period fields from Subscription
  const fullSubscription = await stripe.subscriptions.retrieve(subscription.id, {
    expand: ['latest_invoice'],
  })
  const result = await syncSubscriptionToDatabase(fullSubscription, supabaseAdmin)
  if (!result.success) {
    throw new Error(`Sync failed: ${result.error}`)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Stale-replay safety: syncSubscriptionDeletion updates WHERE stripe_subscription_id = :id.
  // If the customer has since re-subscribed, the row holds a newer subscription ID and the
  // update is a no-op — the stale event can't clobber the new subscription. Don't refactor
  // this to update by student_id without adding an explicit monotonic guard.
  const result = await syncSubscriptionDeletion(subscription.id, supabaseAdmin)
  if (!result.success) {
    throw new Error(`Deletion sync failed: ${result.error}`)
  }
}

/**
 * Extract a subscription ID from a value that may be a string ID or expanded Subscription object.
 */
function extractSubscriptionId(raw: string | Stripe.Subscription | null | undefined): string | null {
  if (!raw) return null
  return typeof raw === 'string' ? raw : raw.id
}

/**
 * Extract subscription ID from a Clover-era Invoice object.
 * In Clover API versions, `invoice.subscription` was moved to
 * `invoice.parent.subscription_details.subscription`.
 */
function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = extractSubscriptionId(invoice.parent?.subscription_details?.subscription)
  if (fromParent) return fromParent

  const lineItem = invoice.lines?.data?.[0]
  const fromLineItem = extractSubscriptionId(lineItem?.parent?.subscription_item_details?.subscription)
  if (fromLineItem) return fromLineItem

  return extractSubscriptionId(lineItem?.subscription)
}

/**
 * Resolve parentId and studentId from an invoice using a 3-tier fallback:
 * 1. Invoice's parent subscription_details metadata (Clover-era)
 * 2. Stripe subscription metadata (API call)
 * 3. Existing child_subscriptions DB record
 */
async function resolveInvoiceMetadata(
  invoice: Stripe.Invoice,
  subscriptionId: string,
): Promise<{ parentId: string; studentId: string | null }> {
  const invoiceMetadata = invoice.parent?.subscription_details?.metadata
  let parentId = invoiceMetadata?.supabase_parent_id
  let studentId = invoiceMetadata?.supabase_student_id

  if (!parentId || !studentId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    parentId = parentId || subscription.metadata.supabase_parent_id
    studentId = studentId || subscription.metadata.supabase_student_id
  }

  if (!parentId || !studentId) {
    const { data: existingSub } = await supabaseAdmin
      .from('child_subscriptions')
      .select('parent_id, student_id')
      .eq('stripe_subscription_id', subscriptionId)
      .single()

    if (existingSub) {
      parentId = parentId || existingSub.parent_id
      studentId = studentId || existingSub.student_id
    }
  }

  if (!parentId) {
    throw new Error(`Missing parent_id for invoice ${invoice.id}, subscription ${subscriptionId}`)
  }

  return { parentId, studentId: studentId || null }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = extractInvoiceSubscriptionId(invoice)

  if (!subscriptionId) {
    throw new Error(`No subscription ID found on invoice ${invoice.id}`)
  }

  const { parentId, studentId } = await resolveInvoiceMetadata(invoice, subscriptionId)

  // Get tier from line item's price (Clover-era: pricing.price_details.price)
  const priceId = invoice.lines?.data?.[0]?.pricing?.price_details?.price
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('stripe_price_id', priceId)
    .single()

  if (!plan) {
    console.warn(`No plan found for price ${priceId}, tier will be null`)
  }

  // Use Stripe's authoritative payment timestamp instead of DB-default now(),
  // so the displayed payment date matches the Stripe event (not webhook insert lag)
  const paidAtTs = invoice.status_transitions?.paid_at ?? invoice.created
  const paidAt = new Date(paidAtTs * 1000).toISOString()

  // Upsert (not insert) so Stripe retries and manual replays converge on the
  // same row. Also handles failed-then-paid transitions where the failed row
  // is rewritten to succeeded on the follow-up invoice.paid event.
  const { error } = await supabaseAdmin.from('payment_history').upsert(
    {
      parent_id: parentId,
      student_id: studentId,
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscriptionId,
      amount_cents: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      tier: plan?.id || null,
      description: invoice.lines?.data?.[0]?.description || 'Subscription payment',
      created_at: paidAt,
      metadata: {
        invoice_number: invoice.number,
        billing_reason: invoice.billing_reason,
      },
    },
    { onConflict: 'stripe_invoice_id' },
  )

  if (error) {
    throw new Error(`Error recording payment for invoice ${invoice.id}: ${error.message}`)
  }

  console.log(`Payment recorded for invoice ${invoice.id}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = extractInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    throw new Error(`No subscription ID on failed payment invoice ${invoice.id}`)
  }

  const { parentId, studentId } = await resolveInvoiceMetadata(invoice, subscriptionId)

  const failedAt = new Date(invoice.created * 1000).toISOString()

  const { error } = await supabaseAdmin.from('payment_history').upsert(
    {
      parent_id: parentId,
      student_id: studentId,
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscriptionId,
      amount_cents: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      description: 'Payment failed',
      created_at: failedAt,
      metadata: {
        invoice_number: invoice.number,
        attempt_count: invoice.attempt_count,
      },
    },
    { onConflict: 'stripe_invoice_id' },
  )

  if (error) {
    throw new Error(`Error recording failed payment for invoice ${invoice.id}: ${error.message}`)
  }

  console.log(`Failed payment recorded for invoice ${invoice.id}`)
}
