import { serve } from '@hono/node-server';
import Stripe from 'stripe';
import { need, needOrigin, optional, serviceClient, log } from '../env';
import { createApp } from './app';

const stripeKey = optional('STRIPE_SECRET_KEY');
const app = createApp(
  serviceClient(),
  { webOrigin: needOrigin('WEB_ORIGIN'), apiPublicUrl: needOrigin('API_PUBLIC_URL') },
  stripeKey ? new Stripe(stripeKey) : null,
);
need('CREDENTIALS_KEY');

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => log({ msg: 'api listening', port }));
