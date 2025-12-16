import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { stripe, WEBHOOK_SECRET, corsHeaders } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import {
  syncSubscriptionToDatabase,
  syncSubscriptionDeletion,
} from '../_shared/sync-helpers.ts'
import type Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'

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

    console.log(`Processing webhook event: ${event.type}`)

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

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(`Webhook Error: ${(error as Error).message}`, { status: 400 })
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

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return

  // Fetch subscription to get metadata
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
  const parentId = subscription.metadata.supabase_parent_id
  const studentId = subscription.metadata.supabase_student_id

  if (!parentId) {
    console.error('Missing parent_id in subscription metadata')
    return
  }

  // Get tier from first line item price
  const priceId = invoice.lines.data[0]?.price?.id
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('stripe_price_id', priceId)
    .single()

  // Record payment
  const { error } = await supabaseAdmin.from('payment_history').insert({
    parent_id: parentId,
    student_id: studentId || null,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: (invoice.payment_intent as string) || null,
    stripe_subscription_id: invoice.subscription as string,
    amount_cents: invoice.amount_paid,
    currency: invoice.currency,
    status: 'succeeded',
    tier: plan?.id || null,
    description: invoice.lines.data[0]?.description || 'Subscription payment',
    metadata: {
      invoice_number: invoice.number,
      billing_reason: invoice.billing_reason,
    },
  })

  if (error) {
    console.error('Error recording payment:', error)
  } else {
    console.log(`Payment recorded for invoice ${invoice.id}`)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return

  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
  const parentId = subscription.metadata.supabase_parent_id
  const studentId = subscription.metadata.supabase_student_id

  if (!parentId) {
    console.error('Missing parent_id in subscription metadata')
    return
  }

  // Record failed payment
  const { error } = await supabaseAdmin.from('payment_history').insert({
    parent_id: parentId,
    student_id: studentId || null,
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: invoice.subscription as string,
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
