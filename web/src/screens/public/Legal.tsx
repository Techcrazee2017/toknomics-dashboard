import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SITE } from '../../lib/site';
import { useTitle } from '../../lib/useTitle';
import { PublicLayout } from './PublicLayout';

const Mail = () => <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;

function LegalPage(p: { title: string; children: ReactNode }) {
  useTitle(`${p.title} · TokNomics`);
  return (
    <PublicLayout>
      <article className="tn-legal">
        <header>
          <h1>{p.title}</h1>
          <p className="tn-legal-meta">Last updated {SITE.legalUpdated}</p>
        </header>
        {p.children}
      </article>
    </PublicLayout>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>These Terms of Service ("Terms") are an agreement between you and {SITE.company} ("we", "us") covering your use of {SITE.product} at {SITE.url} (the "Service"). By creating an account or using the Service you agree to these Terms. If you use the Service for an agency or other business, you confirm you're authorized to accept these Terms on its behalf, and "you" includes that business.</p>

      <h2>1. The Service</h2>
      <p>{SITE.product} records TikTok LIVE gift activity for the creators you choose to track and turns it into a ledger and profit-and-loss figures for your agency. It reads that activity using your own Euler Stream account. {SITE.product} is an independent product and is not affiliated with, endorsed by or sponsored by TikTok, ByteDance or Euler Stream.</p>

      <h2>2. Your account</h2>
      <p>Give accurate information, keep your sign-in method secure, and tell us promptly at <Mail /> if you suspect unauthorized access. You're responsible for activity under your account and for the teammates you invite and the roles you give them.</p>

      <h2>3. Your Euler Stream and TikTok accounts</h2>
      <p>You need your own Euler Stream account and API key. You're responsible for complying with Euler Stream's and TikTok's terms, and you confirm you're authorized to use every account, key, token or cookie you submit. We store credentials encrypted and use them only to provide the Service to your agency.</p>
      <p>If you choose cookie mode, you give the Service a TikTok session cookie, which works like being signed in to that TikTok account. TikTok may restrict or suspend accounts used this way. You use cookie mode at your own risk.</p>
      <p>The Service depends on Euler Stream, TikTok and our hosting providers. Their outages or changes can interrupt data collection, and gifts sent while collection is interrupted may not be recorded.</p>

      <h2>4. Subscriptions and billing</h2>
      <p>Paid plans are billed monthly in advance through our payment processor, Stripe, at the prices on our <Link to="/pricing">Pricing</Link> page plus any applicable taxes. Subscriptions renew automatically each month until cancelled. If a plan includes a free trial, a payment method is required and billing starts when the trial ends unless you cancel before then.</p>
      <p>You can cancel anytime from Plan &amp; billing. Cancellation takes effect at the end of the current billing period and you keep access until then. Refunds are covered by our <Link to="/refunds">Refunds &amp; cancellation policy</Link>. If a payment fails we may suspend paid features until it's resolved. We'll give at least 30 days' notice of a price change before it applies to your subscription.</p>

      <h2>5. Acceptable use</h2>
      <p>Don't use the Service to break the law or anyone's rights, to harass or harm others, to probe, disrupt or overload the Service or the services it depends on, to resell or share access outside your agency, or to work around plan limits or security controls.</p>

      <h2>6. Your data</h2>
      <p>You own the data you put into the Service and the records it collects for your agency. You let us host, process and display that data to provide and support the Service, as our <Link to="/privacy">Privacy Policy</Link> describes. You're responsible for having a lawful basis for any personal data about others, such as creators and gifters, that you track with the Service.</p>

      <h2>7. Our property</h2>
      <p>The Service, its software and its design belong to {SITE.company}. These Terms give you a limited, non-exclusive, non-transferable right to use the Service while your account is in good standing.</p>

      <h2>8. Suspension and termination</h2>
      <p>You can stop using the Service at any time. We may suspend or end your access if you breach these Terms, create risk for us or others, or don't pay. Sections 6 and 9 to 13 survive termination.</p>

      <h2>9. Disclaimers</h2>
      <p>The Service is provided "as is" and "as available". Figures in the Service are estimates calculated from the rates and settings you choose; they are not TikTok payout statements and not financial, tax or legal advice. To the extent the law allows, we disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement.</p>

      <h2>10. Limitation of liability</h2>
      <p>To the extent the law allows, neither party is liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue or data, and our total liability for all claims relating to the Service is limited to the fees you paid us in the 12 months before the claim arose.</p>

      <h2>11. Indemnity</h2>
      <p>You'll defend and indemnify {SITE.company} against third-party claims arising from your use of the Service, the credentials you submit, or your breach of these Terms or of Euler Stream's or TikTok's terms.</p>

      <h2>12. Changes to these Terms</h2>
      <p>We may update these Terms. We'll post the new version here and, for material changes, email account owners before they take effect. Continuing to use the Service after that means you accept the updated Terms.</p>

      <h2>13. Governing law</h2>
      <p>These Terms are governed by the laws of the State of {SITE.governingState}, without regard to its conflict-of-law rules, and disputes will be brought in the state or federal courts located there.</p>

      <h2>14. Contact</h2>
      <p>{SITE.company} · <Mail /></p>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This policy explains what personal data {SITE.company} ("we") collects through {SITE.product} (the "Service"), how we use it, and your choices. Contact us at <Mail /> with any question or request.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> your email address, name and sign-in records.</li>
        <li><strong>Agency data you enter:</strong> agency name and settings, teammates' emails and roles, the TikTok handles of creators on your roster and of your gifter accounts, and the tags you add.</li>
        <li><strong>TikTok LIVE activity:</strong> for creators you track and battle opponents you pin, gift events from their public LIVE streams as Euler Stream delivers them, including the sender's and recipient's public TikTok profile details (such as handle, nickname, ID, profile picture, follower counts and badges), the gift, amounts and times, and stream status such as viewer counts.</li>
        <li><strong>Moderation records:</strong> moderation actions your team takes through the Service, including the TikTok user IDs of viewers you mute or ban.</li>
        <li><strong>Credentials:</strong> your Euler Stream API key and, if you use them, OAuth tokens or a TikTok session cookie. These are encrypted at rest (AES-256-GCM), never sent to your browser, and decrypted only on our servers to call Euler Stream for you.</li>
        <li><strong>Billing data:</strong> Stripe processes your payment details; we keep only your Stripe customer and subscription identifiers, plan and billing status.</li>
        <li><strong>Technical data:</strong> IP address and browser details in our hosting providers' logs, and cookieless, aggregated page-view and performance measurements (Vercel Web Analytics and Speed Insights).</li>
      </ul>

      <h2>How we use it</h2>
      <p>To provide and secure the Service, bill your subscription, send service emails such as sign-in links and team invites, answer support requests, and improve the Service. We don't sell personal data and don't use it for advertising.</p>
      <p>If you're in the EEA or UK, we rely on performing our contract with you, our legitimate interest in running and securing the Service, and legal obligations. For TikTok LIVE activity about people who aren't our customers, the agency using the Service decides what to track; we process that data on the agency's behalf.</p>

      <h2>Who we share it with</h2>
      <p>Service providers that process data for us under contract:</p>
      <ul>
        <li>Supabase: database and authentication</li>
        <li>Vercel: website hosting, analytics and performance measurement</li>
        <li>Railway: API and data-collection hosting</li>
        <li>Stripe: payments and billing</li>
        <li>Euler Stream: access to TikTok LIVE data and room moderation through your own Euler Stream account. We send it your API key and, if you use them, your OAuth tokens or TikTok session cookie.</li>
        <li>Our email delivery provider: sign-in and invite emails</li>
      </ul>
      <p>We may also disclose data when the law requires it, to protect rights and safety, or as part of a merger or sale of the business, in which case this policy continues to apply.</p>

      <h2>How long we keep it</h2>
      <p>We keep your data while your account is active. After you close your account or ask us to delete your data, we delete your agency's data within 90 days, except billing records we must keep by law.</p>

      <h2>Security</h2>
      <p>Data is encrypted in transit, credentials are encrypted at rest, and each agency's data is isolated by database row-level security, so members only see the agencies they belong to.</p>

      <h2>Your choices and rights</h2>
      <p>You can ask to access, correct, export or delete your personal data by emailing <Mail />; we'll respond within 30 days. Depending on where you live you may have other rights, including to object to processing or to complain to a data protection authority. If your gifting activity appears in an agency's ledger and you have a request, email us and we'll work with that agency.</p>

      <h2>Cookies and local storage</h2>
      <p>We use your browser's local storage to keep you signed in and to remember preferences such as your selected agency. We don't use advertising or cross-site tracking cookies.</p>

      <h2>Children</h2>
      <p>The Service is for businesses and isn't directed to anyone under 18.</p>

      <h2>International transfers</h2>
      <p>We and our providers process data in the United States and other countries where they operate, with safeguards such as standard contractual clauses where required.</p>

      <h2>Changes</h2>
      <p>We'll post updates here and, for material changes, email account owners before they take effect.</p>

      <h2>Contact</h2>
      <p>{SITE.company} · <Mail /></p>
    </LegalPage>
  );
}

export function Refunds() {
  return (
    <LegalPage title="Refunds & cancellation">
      <h2>Billing</h2>
      <p>Plans are billed monthly in advance through Stripe and renew automatically each month until you cancel. Prices are on our <Link to="/pricing">Pricing</Link> page.</p>

      <h2>Free trials</h2>
      <p>If your plan includes a free trial, a payment method is required to start it. You won't be charged if you cancel before the trial ends; otherwise the first monthly charge is made when it ends.</p>

      <h2>Cancelling</h2>
      <p>A Founder can cancel anytime from Plan &amp; billing in the app. Cancellation takes effect at the end of the current billing period, and your agency keeps access until then. You won't be charged again after cancelling.</p>

      <h2>Refunds</h2>
      <p>Payments aren't refundable, including for partial months, except where the law requires it. If you were charged by mistake, for example a duplicate charge or a charge after you cancelled, email <Mail /> within 30 days and we'll refund it.</p>

      <h2>Changing plans</h2>
      <p>When you switch plans, the change and any price difference are shown before you confirm. Any credit from a change is applied to future invoices rather than refunded.</p>

      <h2>Contact</h2>
      <p>Questions about a charge: <Mail />.</p>
    </LegalPage>
  );
}
