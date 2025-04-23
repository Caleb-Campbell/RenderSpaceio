'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession, createCreditCheckoutSession } from './stripe';
import { withTeam } from '@/lib/auth/middleware';

export const checkoutAction = withTeam(async (formData, team) => {
  const priceId = formData.get('priceId') as string;
  await createCheckoutSession({ team: team, priceId });
});

export const customerPortalAction = withTeam(async (_, team) => {
  const portalSession = await createCustomerPortalSession(team);
  redirect(portalSession.url);
});

export const creditPurchaseAction = withTeam(async (formData, team, userId) => {
  const packageId = formData.get('packageId') as string;
  const credits = parseInt(formData.get('credits') as string, 10);
  const priceInCents = parseInt(formData.get('price') as string, 10);
  
  if (!packageId || !credits || !priceInCents || !userId) {
    throw new Error('Missing required fields for credit purchase');
  }
  
  await createCreditCheckoutSession({ 
    team, 
    userId,
    packageId, 
    credits, 
    priceInCents 
  });
});