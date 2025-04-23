import Stripe from 'stripe';
import { handleSubscriptionChange, stripe, handleCreditPurchase } from '@/lib/payments/stripe';
import { NextRequest, NextResponse } from 'next/server';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Check if this is a credit purchase (one-time payment)
        if (session.mode === 'payment' && session.metadata?.credits) {
          await handleCreditPurchase(session);
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Error processing webhook: ${event.type}`, error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}