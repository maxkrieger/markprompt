import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

import { stripe } from '@/lib/stripe/server';
import { Database } from '@/types/supabase';

interface Data {
  status?: string;
  error?: string;
}

const allowedMethods = ['POST'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (!req.method || !allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const supabase = createServerSupabaseClient<Database>({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabase
    .from('teams')
    .select('stripe_customer_id')
    .eq('id', req.body.teamId)
    .maybeSingle();

  if (error || !data || !data.stripe_customer_id) {
    console.error(
      `[SUBSCRIPTIONS] Customer with team id ${req.body.teamId} not found`,
    );
    return res.status(400).json({ error: 'Customer not found.' });
  }

  const stripeCustomerIdTruncated = (
    data.stripe_customer_id as string
  ).substring(0, 6);

  const subscription = await stripe.subscriptions.list({
    customer: data.stripe_customer_id,
    limit: 1,
  });

  const subscriptionId = subscription.data[0].id;
  if (!subscriptionId) {
    console.error(
      `[SUBSCRIPTIONS] Subscription with team id ${req.body.teamId} and Stripe customer id ${stripeCustomerIdTruncated} not found`,
    );
    return res.status(400).json({ error: 'No subscription found.' });
  }

  const deleted = await stripe.subscriptions.del(subscriptionId);
  if (!deleted?.id) {
    console.error(
      `[SUBSCRIPTIONS] Unable to delete subscription ${subscriptionId.substring(
        0,
        6,
      )} with team id ${
        req.body.teamId
      } and Stripe customer id ${stripeCustomerIdTruncated}.`,
    );
    return res.status(400).json({ error: 'Unable to cancel subscription.' });
  }

  console.info(
    `Subscription canceled. Team id: ${req.body.teamId}, customer id: ${stripeCustomerIdTruncated}`,
  );

  // If there was a subscription, we can safely assume it was cancelled,
  // no need to wait for the webhook to trigger.
  await supabase
    .from('teams')
    .update({
      stripe_customer_id: null,
      stripe_price_id: null,
      billing_cycle_start: null,
    })
    .eq('id', req.body.teamId);

  return res.status(200).end();
}
