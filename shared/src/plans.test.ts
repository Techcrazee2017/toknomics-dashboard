import { describe, expect, it } from 'vitest';
import { PLANS } from './constants';

// Every feature on the pricing page and the Billing screen must exist in the product.
// Add an entry here only when the feature ships.
const SHIPPED = new Set([
  'Up to 10 creators on your roster', 'Up to 50 creators on your roster', 'Up to 150 creators on your roster',
  'One seat for the Founder', 'Team seats for Managers & Moderators',
  'Live gift ledger & agency P&L', 'Creator P&L cards', 'Battle target tracking & rankings', 'Ledger CSV export',
]);

describe('PLANS', () => {
  it('advertises only shipped features', () => {
    for (const p of PLANS) for (const f of p.feats) expect(SHIPPED, `${p.key}: "${f}"`).toContain(f);
  });

  it('roster limits match public.plan_creator_limit() in supabase/migrations', () => {
    expect(Object.fromEntries(PLANS.map(p => [p.key, p.limit]))).toEqual({ starter: 10, growth: 50, scale: 150 });
  });

  it('states each roster limit in the first feature line', () => {
    for (const p of PLANS) expect(p.feats[0]).toBe(`Up to ${p.limit} creators on your roster`);
  });

  it('has one exact monthly price per plan', () => {
    for (const p of PLANS) expect(p.price).toMatch(/^\$\d+$/);
  });
});
