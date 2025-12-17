import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { stripe, corsHeaders } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

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
      { expand: ['items.data.price', 'customer'] }
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

    if (!isUpgrade) {
      // For downgrades, no immediate payment - scheduled for next cycle
      return new Response(
        JSON.stringify({
          isUpgrade: false,
          message: 'Downgrade will be applied at the end of your current billing cycle',
          effectiveDate: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          currentPlan: {
            priceId: currentPriceId,
            amount: currentAmount,
            currency: currentPrice.currency,
          },
          newPlan: {
            priceId: newPriceId,
            amount: newAmount,
            currency: newPrice.currency,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // For upgrades, preview the proration invoice
    const customerId =
      typeof stripeSubscription.customer === 'string'
        ? stripeSubscription.customer
        : stripeSubscription.customer.id

    // Preview what the invoice would look like with the upgrade
    // Using billing_cycle_anchor: 'now' simulation
    const prorationDate = Math.floor(Date.now() / 1000)

    const previewInvoice = await stripe.invoices.createPreview({
      customer: customerId,
      subscription: subscription.stripe_subscription_id,
      subscription_details: {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_date: prorationDate,
        billing_cycle_anchor: 'now',
        proration_behavior: 'create_prorations',
      },
    })

    // Calculate the amounts
    // The preview invoice will show:
    // - Credit for unused time on current plan (negative amount)
    // - Charge for new plan (positive amount)
    // - Net amount is what the user pays today

    const lineItems = previewInvoice.lines.data.map((line) => ({
      description: line.description,
      amount: line.amount,
      currency: line.currency,
      proration: line.proration,
    }))

    // Get plan names for display
    const [currentPlan, newPlan] = await Promise.all([
      supabaseAdmin
        .from('subscription_plans')
        .select('name')
        .eq('stripe_price_id', currentPriceId)
        .single(),
      supabaseAdmin
        .from('subscription_plans')
        .select('name')
        .eq('stripe_price_id', newPriceId)
        .single(),
    ])

    return new Response(
      JSON.stringify({
        isUpgrade: true,
        amountDue: previewInvoice.amount_due,
        currency: previewInvoice.currency,
        lineItems,
        currentPlan: {
          name: currentPlan.data?.name || 'Current Plan',
          priceId: currentPriceId,
          amount: currentAmount,
        },
        newPlan: {
          name: newPlan.data?.name || 'New Plan',
          priceId: newPriceId,
          amount: newAmount,
        },
        message: `You'll be charged ${(previewInvoice.amount_due / 100).toFixed(2)} ${previewInvoice.currency.toUpperCase()} today. Your new billing cycle starts immediately.`,
        newBillingCycleStart: new Date().toISOString(),
        newBillingCycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Approx 1 month
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error previewing upgrade:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
