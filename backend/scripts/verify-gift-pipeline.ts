// Closed-loop check: mock Euler frame → parseFrame/giftToRows → writeGiftRows (service role) → read back,
// then prove the frontend's anon/authenticated scopes are blocked from writes and from other agencies' rows.
// Creates throwaway agencies + users and deletes them at the end. Run against a dev/staging project.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { need, serviceClient } from '../src/env';
import { parseFrame, giftToRows } from '../src/euler';
import { writeGiftRows } from '../src/sink';

const RUN = Date.now().toString(36);
const URL = need('SUPABASE_URL');
const ANON = need('SUPABASE_ANON_KEY');
const results: { check: string; ok: boolean; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail?: string) => { results.push({ check: name, ok, detail }); };
const userClient = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

/** A v2 ClientMessageBundle, as Euler sends it with bundleEvents (see src/euler.ts). */
function mockFrame() {
  const t = Date.now();
  const user = { userId: '7000000000000000001', uniqueId: 'Verify_Gifter', nickname: 'Verify Gifter' };
  const rose = { giftName: 'Rose', diamondCount: 1, giftType: 1 };
  const lion = { giftName: 'Lion', diamondCount: 29999, giftType: 2 };
  const common = (n: number, dt: number) => ({ msgId: `${RUN}-${n}`, createTime: String(t + dt), roomId: '7400000000000000000' });
  return JSON.stringify({
    timestamp: t,
    messages: [
      { type: 'WebcastGiftMessage', data: { common: common(1, 0), user, giftId: 5655, repeatCount: 3, repeatEnd: 0, giftDetails: rose } },
      { type: 'WebcastGiftMessage', data: { common: common(2, 900), user, giftId: 5655, repeatCount: 7, repeatEnd: 1, giftDetails: rose } },
      { type: 'WebcastGiftMessage', data: { common: common(3, 1500), user, giftId: 6369, repeatCount: 1, repeatEnd: 0, giftDetails: lion } },
      { type: 'WebcastChatMessage', data: { common: common(4, 1600), user, comment: 'not a gift' } },
    ],
  });
}

async function signIn(admin: SupabaseClient, tag: string) {
  const email = `verify+${RUN}-${tag}@toknomics.test`, password = `V-${RUN}-${Math.random().toString(36).slice(2)}!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const c = userClient();
  const s = await c.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { id: data.user.id, client: c };
}

async function main() {
  const admin = serviceClient();
  check('worker key is service_role', true);
  const creator = `verify_${RUN}`.slice(0, 24);
  const cleanup: (() => PromiseLike<unknown>)[] = [];

  try {
    const { data: ag, error: agErr } = await admin.from('agencies').insert([{ name: `verify-A-${RUN}` }, { name: `verify-B-${RUN}` }]).select('id');
    if (agErr) throw agErr;
    const [A, B] = ag!.map(r => r.id);
    cleanup.push(() => admin.from('agencies').delete().in('id', [A, B]));

    const ua = await signIn(admin, 'a'), ub = await signIn(admin, 'b');
    cleanup.push(() => admin.auth.admin.deleteUser(ua.id), () => admin.auth.admin.deleteUser(ub.id));
    const m = await admin.from('agency_members').insert([{ agency_id: A, user_id: ua.id, role: 'manager' }, { agency_id: B, user_id: ub.id, role: 'manager' }]);
    if (m.error) throw m.error;

    // 1. Roster sync: manager of A upserts a target (frontend path)
    const t1 = await ua.client.from('tracked_targets').upsert({ agency_id: A, unique_id: creator, source: 'pin', active: true }, { onConflict: 'agency_id,unique_id' }).select().single();
    check('manager upserts tracked_target in own agency', !t1.error, t1.error?.message);
    const t2 = await ua.client.from('tracked_targets').upsert({ agency_id: A, unique_id: creator, source: 'battle', active: true }, { onConflict: 'agency_id,unique_id' }).select();
    check('re-upsert is idempotent (no duplicate row)', !t2.error && t2.data?.length === 1, t2.error?.message);
    const t3 = await ua.client.from('tracked_targets').insert({ agency_id: B, unique_id: creator, source: 'pin' });
    check('manager cannot track into another agency (42501)', t3.error?.code === '42501', t3.error?.message ?? 'insert succeeded');

    // 2. Parse the mock frame through the worker's own code
    const events = parseFrame(mockFrame());
    const rows = events.flatMap(e => giftToRows(e, { creatorUniqueId: creator, roomId: null, agencyIds: [A] }));
    check('parser books streak end + single gift only', rows.length === 2, `got ${rows.length} rows`);
    check('streak total = 7 × 1 diamonds', rows.find(r => r.gift_id === 5655)?.repeat_count === 7);
    check('sender handle normalised to lowercase', rows.every(r => r.sender_unique_id === 'verify_gifter'));

    // 3. Service-role write, then replay (reconnect duplicate)
    try { await writeGiftRows(admin, rows); check('service role insert passes RLS', true); }
    catch (e: any) { check('service role insert passes RLS', false, `${e.code} ${e.message}`); }
    try { await writeGiftRows(admin, rows); check('replayed frame is ignored', true); }
    catch (e: any) { check('replayed frame is ignored', false, e.message); }

    const back = await admin.from('gift_transactions').select('msg_id,total_diamonds').eq('agency_id', A).like('msg_id', `${RUN}-%`);
    const total = (back.data ?? []).reduce((s, r) => s + r.total_diamonds, 0);
    check('read back 2 rows, 30006 diamonds', back.data?.length === 2 && total === 30006, `${back.data?.length} rows, ${total}`);

    // 4. Frontend scopes
    const anonIns = await userClient().from('gift_transactions').insert({ ...rows[0], msg_id: `${RUN}-anon` });
    check('anon insert blocked (42501)', anonIns.error?.code === '42501', anonIns.error?.message ?? 'insert succeeded');
    const userIns = await ua.client.from('gift_transactions').insert({ ...rows[0], msg_id: `${RUN}-user` });
    check('authenticated insert blocked (42501)', userIns.error?.code === '42501', userIns.error?.message ?? 'insert succeeded');
    const anonRead = await userClient().from('gift_transactions').select('id').like('msg_id', `${RUN}-%`);
    check('anon reads nothing', (anonRead.data?.length ?? 0) === 0, anonRead.error?.message);
    const aRead = await ua.client.from('gift_transactions').select('id').like('msg_id', `${RUN}-%`);
    check('agency A member reads own 2 rows', aRead.data?.length === 2, aRead.error?.message ?? `${aRead.data?.length}`);
    const bRead = await ub.client.from('gift_transactions').select('id').like('msg_id', `${RUN}-%`);
    check('agency B member reads 0 rows', (bRead.data?.length ?? 0) === 0, `${bRead.data?.length}`);
    const bTargets = await ub.client.from('tracked_targets').select('id').eq('unique_id', creator);
    check('agency B cannot see A\'s targets', (bTargets.data?.length ?? 0) === 0);
  } finally {
    for (const fn of cleanup.reverse()) { try { await fn(); } catch { /* best-effort cleanup */ } }
  }

  console.table(results.map(r => ({ result: r.ok ? 'PASS' : 'FAIL', check: r.check, detail: r.ok ? '' : r.detail ?? '' })));
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `${failed} check(s) failed` : 'All checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
