import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { PLANS } from '@toknomics/shared';
import { PlanCard } from '../../components/PlanCard';
import { SITE } from '../../lib/site';
import { useTitle } from '../../lib/useTitle';
import { PublicLayout } from './PublicLayout';

const FEATURES = [
  ['ph-receipt', 'Live gift ledger', 'Every gift your gifter accounts send to tracked creators is booked as it happens: sender, coins and the purpose you tag it with.'],
  ['ph-chart-line-up', 'Agency P&L', 'Coins your gifter accounts burn against the commission your creators earn, at your own coin and diamond rates and agency cut.'],
  ['ph-identification-card', 'Creator P&L cards', "Each creator's diamonds, commission and the gifting spent on them, side by side."],
  ['ph-sword', 'Battle target tracking', 'Pin creators and their battle opponents, and see who is live and what each battle is worth.'],
  ['ph-ranking', 'Rankings & discovery', "TikTok LIVE leaderboards and a live feed by region, so you can find who's worth recruiting."],
  ['ph-users-three', 'Roles for your team', 'Founders, Managers and Moderators each get the permissions their role needs (Scale plan).'],
] as const;

const STEPS = [
  ['Create your agency workspace', 'Sign in with your work email and name your agency. You are its Founder.'],
  ['Connect Euler Stream', 'Paste your own Euler Stream API key. TokNomics uses it to read TikTok LIVE events, stores it encrypted and never sends it to your browser.'],
  ['Add gifter accounts and creators', 'Tell TokNomics which accounts gift for your agency and which creators you manage. The ledger fills in live.'],
] as const;

export const FAQ: [string, ReactNode][] = [
  ['What else do I need?', 'Your own Euler Stream account and API key. TokNomics connects to TikTok LIVE through it. Euler Stream is a separate service with its own plans and pricing; larger rosters may need a paid Euler Stream plan.'],
  ['How are the numbers calculated?', "Agency burn is the coins your gifter accounts send times your coin rate. Creator commission is the diamonds a creator receives while tracked times your diamond rate times your agency cut. You set the rates and the cut; they're estimates, not TikTok's payout statements."],
  ['Can I cancel anytime?', <>Yes. Cancel from Plan &amp; billing; your plan stays active until the end of the period you paid for. See the <Link to="/refunds">Refunds &amp; cancellation policy</Link>.</>],
  ['Is TokNomics affiliated with TikTok?', 'No. TokNomics is an independent product and is not affiliated with, endorsed by or sponsored by TikTok, ByteDance or Euler Stream.'],
  ['How do I get help?', `Email ${SITE.email}. Every plan includes email support.`],
];

export function PlanGrid() {
  return (
    <div className="tn-pub-plans">
      {PLANS.map(t => <PlanCard key={t.key} plan={t} action={<Link to="/login" className="btn btn-secondary btn-block">Get started with {t.short}</Link>} />)}
    </div>
  );
}

export function Faq() {
  return (
    <div className="tn-pub-faq">
      {FAQ.map(([q, a]) => <details key={q} className="card tn-card"><summary>{q}</summary><p>{a}</p></details>)}
    </div>
  );
}

export function Landing() {
  useTitle('TokNomics: gift ledger and P&L for TikTok LIVE agencies');
  // Sign-in and invite links land here; a failed one comes back with an error in the URL.
  const { hash, search } = useLocation();
  if (new URLSearchParams(hash.slice(1)).has('error_description') || new URLSearchParams(search).has('error_description'))
    return <Navigate to="/login" replace state={{ linkFailed: true }} />;
  return (
    <PublicLayout>
      <section className="tn-pub-hero">
        <span className="card-kicker">For TikTok LIVE agencies</span>
        <h1>Know what every gift earns your agency</h1>
        <p>TokNomics books the coins your gifter accounts send and the diamonds your creators earn as it happens, so you see estimated profit per creator and per day, and what each battle is worth.</p>
        <div className="tn-row-8 tn-pub-cta">
          <Link to="/login" className="btn btn-primary">Get started</Link>
          <Link to="/pricing" className="btn btn-secondary">See pricing</Link>
        </div>
      </section>

      <section className="tn-pub-section" aria-labelledby="features">
        <h2 id="features">Everything your agency's numbers need</h2>
        <div className="tn-pub-features">
          {FEATURES.map(([icon, title, body]) => (
            <div key={title} className="card elev-sm tn-card">
              <i className={'ph ' + icon} aria-hidden style={{ fontSize: 22, color: 'var(--color-accent)' }} />
              <span className="card-title">{title}</span>
              <p className="card-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="tn-pub-section" aria-labelledby="how">
        <h2 id="how">Up and running in minutes</h2>
        <ol className="tn-pub-steps">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="card elev-sm tn-card"><span className="card-kicker">Step {i + 1}</span><span className="card-title">{title}</span><p className="card-body">{body}</p></li>
          ))}
        </ol>
      </section>

      <section className="tn-pub-section" aria-labelledby="pricing">
        <h2 id="pricing">Pricing</h2>
        <p className="tn-pub-lede">Priced by roster size and team seats. Every plan includes the full ledger and P&amp;L; Scale adds team seats. Billed monthly, cancel anytime.</p>
        <PlanGrid />
      </section>

      <section className="tn-pub-section" aria-labelledby="faq">
        <h2 id="faq">Questions</h2>
        <Faq />
      </section>
    </PublicLayout>
  );
}

export function Pricing() {
  useTitle('Pricing · TokNomics');
  return (
    <PublicLayout>
      <section className="tn-pub-hero">
        <span className="card-kicker">Pricing</span>
        <h1>Simple monthly plans</h1>
        <p>Priced by roster size and team seats. Every plan includes the full ledger and P&amp;L; Scale adds team seats. Billed monthly through Stripe, cancel anytime from Plan &amp; billing.</p>
      </section>
      <PlanGrid />
      <p className="tn-pub-note">Prices in USD, before any applicable taxes. TokNomics needs your own Euler Stream account, which Euler Stream bills separately. See the <Link to="/refunds">Refunds &amp; cancellation policy</Link>.</p>
      <section className="tn-pub-section" aria-labelledby="faq">
        <h2 id="faq">Questions</h2>
        <Faq />
      </section>
    </PublicLayout>
  );
}
