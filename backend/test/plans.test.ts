import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLANS } from '@toknomics/shared';

/** Limits from the newest migration that defines public.plan_creator_limit, which the database enforces. */
function migrationLimits() {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const body = readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
    .map(f => readFileSync(new URL(f, dir), 'utf8').match(/create (?:or replace )?function public\.plan_creator_limit\b[^$]*\$\$([\s\S]*?)\$\$/)?.[1])
    .find(Boolean);
  if (!body) throw new Error('No migration defines public.plan_creator_limit');
  return Object.fromEntries([...body.matchAll(/when '(\w+)' then (\d+)/g)].map(m => [m[1], Number(m[2])]));
}

describe('PLANS', () => {
  it('roster limits match public.plan_creator_limit() in supabase/migrations', () => {
    expect(Object.fromEntries(PLANS.map(p => [p.key, p.limit]))).toEqual(migrationLimits());
  });
});
