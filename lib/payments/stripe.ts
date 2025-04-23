import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Team } from '@/lib/db/schema';
import {
  getTeamByStripeCustomerId,
  getUser,
  updateTeamSubscription
} from '@/lib/db/queries';
import { addCredits } from '@/lib/render';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

export async function createCheckoutSession({
  team,
  priceId
}: {
  team: Team | null;
  priceId: string;
}) {
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: team.stripeCustomerId || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14
    }
  });

  redirect(session.url!);
}

export async function createCreditCheckoutSession({
  team,
  userId,
  packageId,
  credits,
  priceInCents
}: {
  team: Team;
  userId: number;
  packageId: string;
  credits: number;
  priceInCents: number;
}) {
  // Create a product for this credit package
  const product = await stripe.products.create({
    name: `${credits} Render Credits`,
    description: `${credits} credits for AI interior design renders`,
  });

  // Create a one-time price for the product
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: priceInCents,
    currency: 'usd',
  });

  // Create the checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: price.id,
        quantity: 1,
      }
    ],
    mode: 'payment',
    success_url: `${process.env.BASE_URL}/api/stripe/credit-success?session_id={CHECKOUT_SESSION_ID}&package_id=${packageId}&credits=${credits}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: team.stripeCustomerId || undefined,
    client_reference_id: `team:${team.id}|user:${userId}|package:${packageId}|credits:${credits}`,
    allow_promotion_codes: true,
    metadata: {
      teamId: team.id.toString(),
      userId: userId.toString(),
      packageId,
      credits: credits.toString(),
    },
  });

  redirect(session.url!);
}

export async function handleCreditPurchase(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  
  if (!metadata?.teamId || !metadata?.userId || !metadata?.credits) {
    console.error('Missing metadata for credit purchase:', session.id);
    return;
  }
  
  const teamId = parseInt(metadata.teamId, 10);
  const userId = parseInt(metadata.userId, 10);
  const credits = parseInt(metadata.credits, 10);
  
  try {
    // Add credits to the team
    await addCredits({
      teamId,
      userId,
      amount: credits,
      description: `Purchased ${credits} credits`,
      paymentId: session.payment_intent as string,
    });
    
    console.log(`Successfully added ${credits} credits to team ${teamId}`);
  } catch (error) {
    console.error('Error adding credits:', error);
  }
}

export async function createCustomerPortalSession(team: Team) {
  if (!team.stripeCustomerId || !team.stripeProductId) {
    redirect('/pricing');
  }

  let configuration: Stripe.BillingPortal.Configuration;
  const configurations = await stripe.billingPortal.configurations.list();

  if (configurations.data.length > 0) {
    configuration = configurations.data[0];
  } else {
    const product = await stripe.products.retrieve(team.stripeProductId);
    if (!product.active) {
      throw new Error("Team's product is not active in Stripe");
    }

    const prices = await stripe.prices.list({
      product: product.id,
      active: true
    });
    if (prices.data.length === 0) {
      throw new Error("No active prices found for the team's product");
    }

    configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your subscription'
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: prices.data.map((price) => price.id)
            }
          ]
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other'
            ]
          }
        }
      }
    });
  }

  return stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard`,
    configuration: configuration.id
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  if (status === 'active' || status === 'trialing') {
    const plan = subscription.items.data[0]?.plan;
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: subscriptionId,
      stripeProductId: plan?.product as string,
      planName: (plan?.product as Stripe.Product).name,
      subscriptionStatus: status
    });
  } else if (status === 'canceled' || status === 'unpaid') {
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      subscriptionStatus: status
    });
  }
}

export async function getStripePrices() {
  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring'
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days
  }));
}

export async function getStripeProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price']
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id
  }));
}