import { NextResponse } from 'next/server';
import { stripe, handleCreditPurchase } from '@/lib/payments/stripe';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return new Response('Missing session ID', { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Process the credit purchase if it was successful
    if (session.payment_status === 'paid') {
      await handleCreditPurchase(session);
    }
    
    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error processing credit purchase success:', error);
    return new Response('Error processing credit purchase', { status: 500 });
  }
}