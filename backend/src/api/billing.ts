// Stripe subscription billing. The webhook is the only writer of agencies.plan.
import type { Hono } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { CheckoutBody, type CheckoutResult, type PlanKey } from '@toknomics/shared';
import { optional, log } from '../env';
import { HttpError, allow, jsonBody, parseBody, requireMember, requireUser, type AppEnv } from './http';
import type { AppConfig } from './app';

export function priceFor(plan: PlanKey): string {
  const id = optional(`STRIPE_PRICE_${plan.toUpperCase()}`);
  if (!id) throw new HttpError(503, `Billing is not configured (STRIPE_PRICE_${plan.toUpperCase()})`, 'billing_unconfigured');
  return id;
}

export function planForPrice(priceId: string | undefined): PlanKey | null {
  for (const p of ['starter', 'growth', 'scale'] as const) if (priceId && optional(`STRIPE_PRICE_${p.toUpperCase()}`) === priceId) return p;
  return null;
}

/** Maps a Stripe subscription onto the agency row. Exported for tests. */
export function subscriptionPatch(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const plan = planForPrice(item?.price.id);
  const end = (item as { current_period_end?: number } | undefined)?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  const live = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  return {
    plan: live && plan ? plan : 'starter',
    subscription_status: sub.status,
    plan_renews_at: end ? new Date(end * 1000).toISOString() : null,
    stripe_subscription_id: sub.status === 'canceled' ? null : sub.id,
  };
}

export function billingRoutes(app: Hono<AppEnv>, db: SupabaseClient, stripe: Stripe | null, cfg: AppConfig) {
  const needStripe = () => { if (!stripe) throw new HttpError(503, 'Billing is not configured (STRIPE_SECRET_KEY)', 'billing_unconfigured'); return stripe; };

  app.post('/api/stripe/webhook', async c => {
    const s = needStripe();
    const secret = optional('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new HttpError(503, 'STRIPE_WEBHOOK_SECRET is not set');
    let event: Stripe.Event;
    try {
      event = await s.webhooks.constructEventAsync(await c.req.text(), c.req.header('stripe-signature') ?? '', secret);
    } catch {
      throw new HttpError(400, 'Invalid signature');
    }
    const sync = async (sub: Stripe.Subscription, agencyId?: string | null) => {
      const patch = subscriptionPatch(sub);
      const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const q = db.from('agencies').update({ ...patch, stripe_customer_id: customer });
      const { error } = agencyId ? await q.eq('id', agencyId) : await q.eq('stripe_customer_id', customer);
      if (error) throw new HttpError(500, 'Could not update the plan');
    };
    switch (event.type) {
      case 'checkout.session.completed': {
        const cs = event.data.object;
        if (cs.mode === 'subscription' && cs.subscription && cs.client_reference_id) {
          await sync(await s.subscriptions.retrieve(typeof cs.subscription === 'string' ? cs.subscription : cs.subscription.id), cs.client_reference_id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await sync(event.data.object, event.data.object.metadata?.agency_id);
        break;
    }
    log({ msg: 'stripe event', type: event.type, id: event.id });
    return c.json({ received: true });
  });

  const b = app.basePath('/api/agencies/:agencyId/billing');
  b.use('*', requireUser(db), requireMember(db));

  b.post('/checkout', async c => {
    allow(c, 'manageBilling', 'Only Founders can change the plan');
    const s = needStripe();
    const { plan } = parseBody(CheckoutBody, await jsonBody(c));
    const aid = c.get('agencyId');
    const { data: ag, error } = await db.from('agencies').select('name, stripe_customer_id, stripe_subscription_id').eq('id', aid).single();
    if (error) throw new HttpError(500, 'Could not load the agency');
    const price = priceFor(plan);

    if (ag.stripe_subscription_id) {
      // Existing subscriber: swap the price; the new amount bills from the next renewal (no proration)
      const sub = await s.subscriptions.retrieve(ag.stripe_subscription_id);
      const item = sub.items.data[0];
      if (!item) throw new HttpError(500, 'Subscription has no items');
      await s.subscriptions.update(sub.id, { items: [{ id: item.id, price }], proration_behavior: 'none', metadata: { agency_id: aid } });
      return c.json({ switched: true } satisfies CheckoutResult);
    }

    let customer = ag.stripe_customer_id as string | null;
    if (!customer) {
      const cu = await s.customers.create({ name: ag.name, email: c.get('user').email, metadata: { agency_id: aid } });
      customer = cu.id;
      await db.from('agencies').update({ stripe_customer_id: customer }).eq('id', aid);
    }
    const session = await s.checkout.sessions.create({
      mode: 'subscription', customer, client_reference_id: aid,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { agency_id: aid } },
      success_url: `${cfg.webOrigin}/billing?checkout=success`,
      cancel_url: `${cfg.webOrigin}/billing?checkout=cancelled`,
    });
    if (!session.url) throw new HttpError(502, 'Stripe did not return a checkout URL');
    return c.json({ url: session.url } satisfies CheckoutResult);
  });

  b.post('/portal', async c => {
    allow(c, 'manageBilling');
    const s = needStripe();
    const { data: ag } = await db.from('agencies').select('stripe_customer_id').eq('id', c.get('agencyId')).single();
    if (!ag?.stripe_customer_id) throw new HttpError(409, 'No billing account yet. Choose a plan first.');
    const p = await s.billingPortal.sessions.create({ customer: ag.stripe_customer_id, return_url: `${cfg.webOrigin}/billing` });
    return c.json({ url: p.url });
  });
}
