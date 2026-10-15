import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SITE } from '../../lib/site';

/** Header, footer and page frame shared by the landing, pricing and legal pages. */
export function PublicLayout(p: { children: ReactNode }) {
  return (
    <div className="tn-pub">
      <div className="tn-texture lighten" aria-hidden />
      <header className="tn-pub-nav">
        <Link to="/" className="tn-pub-brand">{SITE.product}</Link>
        <nav className="tn-pub-links" aria-label="Main">
          <Link to="/pricing" className="btn btn-ghost">Pricing</Link>
          <Link to="/login" className="btn btn-secondary">Sign in</Link>
        </nav>
      </header>
      <main className="tn-pub-main">{p.children}</main>
      <footer className="tn-pub-foot">
        <nav className="tn-pub-foot-links" aria-label="Legal">
          <Link to="/pricing">Pricing</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/refunds">Refunds &amp; cancellation</Link>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </nav>
        <p>© {new Date().getFullYear()} {SITE.company}. {SITE.product} is not affiliated with, endorsed by or sponsored by TikTok, ByteDance or Euler Stream.</p>
      </footer>
    </div>
  );
}
