import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CAN, CLOSE_CODES, TOOL_GROUPS, isHandle, normalizeUniqueId, type UpdateConnectionBody } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { api, ApiRequestError, dbError } from '../lib/api';
import { keys, useAccounts, useCalls, useCatalog, useConnection, useGiftUsage, useStreamStatus, useTargets } from '../lib/data';
import { ago, at, money } from '../lib/format';
import { supabase } from '../lib/supabase';
import { connectionLook, PageHeader } from '../components/Shell';
import { Code, Dialog, Dot, Field, Seg } from '../components/ui';
import { workerLine } from './LiveTargets';
import { SNIP_JWT, SNIP_SDK, SNIP_WS, snipConnector, snipSdkTs } from './snippets';

type Form = { host: string; apiKey: string; pinned: string; cookie: string };

export function DataSource() {
  const { agency, role, toast, now } = useAgency();
  const qc = useQueryClient();
  const conn = useConnection(agency.id);
  const c = conn.data;
  const [params, setParams] = useSearchParams();
  const isAdmin = CAN.manageCredentials(role);
  const oauth = (c?.mode ?? 'oauth') === 'oauth';
  const [form, setForm] = useState<Form>({ host: '', apiKey: '', pinned: '', cookie: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'' | 'save' | 'connect' | 'test' | 'mode' | 'delete'>('');
  const [risk, setRisk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (c) setForm(f => ({ ...f, host: c.host, pinned: c.pinned_user_id ?? '' })); }, [c?.host, c?.pinned_user_id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Results of the OAuth round-trip come back as query params from the API's callback
  useEffect(() => {
    const ok = params.get('euler'), err = params.get('euler_error');
    if (ok === 'connected') toast('Connected to Euler Stream');
    if (err) toast(err);
    if (ok || err) setParams({}, { replace: true });
  }, [params, setParams, toast]);

  const refresh = () => void qc.invalidateQueries({ queryKey: keys.connection(agency.id) });
  const fail = (e: unknown) => {
    if (e instanceof ApiRequestError && e.fields) setErrs(e.fields);
    toast((e as Error).message);
  };
  const pending = (): UpdateConnectionBody => {
    const b: UpdateConnectionBody = {};
    if (c && form.host.trim() !== c.host && isAdmin) b.host = form.host.trim();
    if (form.apiKey.trim() && isAdmin) b.apiKey = form.apiKey.trim();
    if (form.cookie.trim() && isAdmin) b.cookie = form.cookie.trim();
    // Also on its own, for a cookie stored before the acknowledgement existed: ticking the box must be savable without re-pasting the cookie.
    if (risk && isAdmin && c && !c.cookie_ack_at && (b.cookie || c.has_cookie || c.mode === 'cookie')) b.cookieRisk = true;
    if (c && form.pinned.trim() !== (c.pinned_user_id ?? '')) b.pinnedUserId = form.pinned.trim();
    return b;
  };
  const dirty = Object.keys(pending()).length > 0;
  const save = async () => {
    const b = pending();
    if (!Object.keys(b).length) return true;
    try { await api.updateConnection(agency.id, b); setForm(f => ({ ...f, apiKey: '', cookie: '' })); setErrs({}); refresh(); return true; }
    catch (e) { fail(e); return false; }
  };
  const run = async (kind: typeof busy, fn: () => Promise<unknown>) => { setBusy(kind); try { await fn(); } catch (e) { fail(e); } finally { setBusy(''); } };

  const switchMode = (m: 'oauth' | 'cookie') => {
    if (!c || m === c.mode) return;
    if (m === 'cookie' && !c.cookie_ack_at && !risk) { setErrs({ cookieRisk: 'Tick the box to accept the risk of cookie mode first' }); return; }
    void run('mode', async () => {
      await api.updateConnection(agency.id, { mode: m, ...(m === 'cookie' && risk ? { cookieRisk: true as const } : {}) });
      refresh();
      toast(m === 'oauth' ? 'Switched to OAuth. Reconnect to resume moderation.' : 'Switched to Cookie mode. Reconnect to resume moderation.');
    });
  };
  /** Saves host / key / pinned user. A new API key is checked with Euler before it is kept. */
  const saveKey = (e?: FormEvent) => {
    e?.preventDefault();
    void run('save', async () => { if (await save()) toast(form.apiKey.trim() ? 'API key verified and saved. Live data is on.' : 'Saved'); });
  };
  const connect = (e?: FormEvent) => {
    e?.preventDefault();
    void run('connect', async () => {
      if (!(await save())) return;
      const r = await api.connect(agency.id);
      refresh();
      if (r.status === 'authorizing') window.location.assign(r.authorizeUrl);
      else toast('Room moderation connected');
    });
  };

  const host = (c?.host || form.host || '<host>').trim();
  const url = `https://${host}/mcp?${oauth ? 'oauth=true&' : ''}apiKey=YOUR_API_KEY${oauth && c?.pinned_user_id ? '&pinned_user_id=' + c.pinned_user_id : ''}`;
  const [cfg, setCfg] = useState<'remote' | 'direct'>('remote');
  const configJson = JSON.stringify({ mcpServers: { 'euler-stream': cfg === 'direct' ? { url } : { command: 'npx', args: ['mcp-remote', url] } } }, null, 2);
  const copy = (text: string, label: string) => navigator.clipboard.writeText(text).then(() => toast(label + ' copied'), () => toast('Copy failed. Select the text instead.'));
  const look = connectionLook(conn.isLoading ? 'loading' : c?.key_status);
  // Live ingestion needs only an accepted API key. `moderating` is the optional OAuth / cookie session for room actions.
  const connected = c?.key_status === 'valid';
  const moderating = c?.status === 'connected';
  const since = c?.connected_at ? Math.floor((now - Date.parse(c.connected_at)) / 60000) : 0;
  const hasKey = !!c?.api_key_last4;

  const targets = useTargets(agency.id);
  const status = useStreamStatus(agency.id);
  const mine = (targets.data ?? []).map(t => ({ t, st: status.data?.get(t.unique_id) }));
  const events = mine.reduce((a, x) => a + Number(x.st?.events_ingested ?? 0), 0);
  const last = mine.map(x => x.st?.last_event_at).filter(Boolean).sort().at(-1);
  const calls = useCalls(agency.id);

  const steps = [
    { title: 'Sign up', body: 'Create a free Euler Stream account with email or a social login.', link: 'https://www.eulerstream.com/register', linkLabel: 'eulerstream.com/register', done: hasKey },
    { title: 'Get your API key', body: 'In the Euler dashboard, create a key and paste it into API key below.', link: 'https://www.eulerstream.com/dashboard', linkLabel: 'Open Euler dashboard', done: hasKey },
    { title: 'Save your key here', body: isAdmin ? 'TokNomics checks the key with Euler and starts live ingestion right away.' : 'Ask a Founder to finish setup. Only Founders can add credentials.', link: '', linkLabel: '', done: connected },
  ];

  return (
    <>
      <PageHeader title="Data source" subtitle="One Euler Stream connection for the whole agency. It feeds the ledger, live targets and P&L." />
      {confirmDelete && (
        <Dialog title="Delete Euler credentials?" onClose={() => setConfirmDelete(false)}
          body="This permanently removes your stored Euler API key, cookie and tokens. Live data stops for this agency until you add a key again. Your ledger and history stay."
          actions={<>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Keep credentials</button>
            <button type="button" className="btn btn-secondary btn-destructive" disabled={busy !== ''} onClick={() => void run('delete', async () => { await api.deleteCredentials(agency.id); setForm(f => ({ ...f, apiKey: '', cookie: '' })); setConfirmDelete(false); refresh(); toast('Euler credentials deleted'); })}><i className="ph ph-trash" />Delete credentials</button>
          </>}>{null}</Dialog>
      )}
      {c && !connected && (
        <section className="card elev-sm tn-card gap-6">
          <div className="tn-card-head"><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="card-kicker">Get started</span><span className="card-title">Set up Euler Stream</span></div><span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{steps.filter(s => !s.done).length} of 3 steps left</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-6)' }}>
            {steps.map((s, i) => (
              <div key={s.title} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                <span className="tnum" style={{ width: 28, height: 28, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, background: s.done ? 'var(--color-accent-800)' : 'transparent', boxShadow: s.done ? 'none' : 'inset 0 0 0 1px var(--color-neutral-700)', color: s.done ? 'var(--color-accent-200)' : 'var(--color-neutral-400)' }}>{s.done ? <i className="ph ph-check" /> : i + 1}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 15 }}>{s.title}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>{s.body}</span>
                  {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{s.linkLabel}<i className="ph ph-arrow-up-right" /></a>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="tn-grid-2">
        <div className="tn-col">
          <form className="card elev-sm tn-card gap-6" onSubmit={saveKey} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="card-kicker">Connection</span><span className="card-title">Euler Stream for {agency.name}</span></div>
            {c?.key_status === 'invalid' && <div className="tn-alert" role="alert"><i className="ph ph-warning" />Euler rejected the saved API key. Live data is paused. Paste a new key to resume.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
              <Field label="Server host" error={errs.host} hint="Shown in the MCP endpoint and client config.">
                <input className="input" value={form.host} onChange={e => { setForm(f => ({ ...f, host: e.target.value })); setErrs({}); }} readOnly={!isAdmin} placeholder="<host>" />
              </Field>
              <Field label={<span className="tn-row-8" style={{ gap: 6 }}>API key{!isAdmin && <i className="ph ph-lock-simple" />}</span>} error={errs.apiKey} hint={hasKey ? 'Stored encrypted and never sent to your browser. Paste a new key to replace it.' : 'Your own key from the Euler dashboard.'}>
                <input className="input mono" style={{ fontSize: 13 }} type="password" autoComplete="off" value={form.apiKey} readOnly={!isAdmin}
                  placeholder={hasKey ? '•'.repeat(10) + c!.api_key_last4 : 'euler_…'} onChange={e => { setForm(f => ({ ...f, apiKey: e.target.value })); setErrs({}); }} />
              </Field>
            </div>
            {!isAdmin && <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Only Founders can change the host, API key or Cookie mode.</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {isAdmin && (!connected || form.apiKey.trim() !== '') && <button type="submit" className="btn btn-primary" disabled={busy !== '' || !form.apiKey.trim()}><i className={busy === 'save' ? 'ph ph-spinner tn-spin' : 'ph ph-key'} />{connected ? 'Verify and replace key' : 'Verify and save key'}</button>}
              {dirty && connected && form.apiKey.trim() === '' && <button type="button" className="btn btn-secondary" disabled={busy !== ''} onClick={() => saveKey()}><i className="ph ph-floppy-disk" />Save changes</button>}
              {connected && <button type="button" className="btn btn-secondary" disabled={busy !== ''} onClick={() => void run('test', async () => { const r = await api.test(agency.id); toast(`Connection healthy · ${r.ms} ms · ${r.eventsPerMin} gifts/min${r.rateLimit ? ` · ${r.rateLimit.remaining}/${r.rateLimit.max} calls left this minute` : ''}`); refresh(); })}><i className="ph ph-pulse" />Test connection</button>}
            </div>
          </form>

          {connected && (
            <form className="card elev-sm tn-card gap-6" onSubmit={connect} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="card-kicker">Optional</span><span className="card-title">Room moderation</span></div>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>Live data, the ledger and rankings already work with your API key. Connect a TikTok session only to mute, ban, add moderators and manage blocked words in rooms you track.</span>
              <div className="field">
                <label>Authentication mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }} role="radiogroup" aria-label="Authentication mode">
                  {([['oauth', 'OAuth', 'Recommended', false], ['cookie', 'Cookie', 'Founders only', !isAdmin]] as const).map(([m, label, sub, locked]) => (
                    <label key={m} className="seg-opt" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 12px', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', opacity: locked ? 0.45 : 1 }}>
                      <input type="radio" name="tn-mode" checked={(c?.mode ?? 'oauth') === m} disabled={locked || busy !== '' || (!isAdmin && role !== 'manager')} onChange={() => switchMode(m)} />
                      <span className="tn-row-8" style={{ gap: 6, fontSize: 14 }}>{label}{locked && <i className="ph ph-lock-simple" style={{ color: 'var(--color-neutral-500)' }} />}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{sub}</span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginTop: 8, lineHeight: 1.5 }}>
                  {oauth ? 'Tools use an x-oauth-token from the Euler OAuth flow. x-cookie-header is ignored. ' : 'Tools use raw TikTok cookies passed as x-cookie-header. No login flow. x-oauth-token is ignored. '}
                  Mode is set at connection time, so switching ends the current session.
                </div>
              </div>
              {isAdmin && !c?.cookie_ack_at && (
                <div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--color-neutral-300)', lineHeight: 1.5 }}>
                    <input type="checkbox" checked={risk} aria-invalid={!!errs.cookieRisk} aria-describedby={errs.cookieRisk ? 'cookie-risk-err' : undefined} onChange={e => { setRisk(e.target.checked); setErrs({}); }} style={{ marginTop: 3 }} />
                    <span>I understand cookie mode signs in to TikTok as that account, and TikTok may restrict accounts used this way. I accept the risk.</span>
                  </label>
                  {errs.cookieRisk && <div id="cookie-risk-err" className="tn-err" role="alert">{errs.cookieRisk}</div>}
                </div>
              )}
              {oauth ? <>
                <Field label="Pinned user ID (optional)" error={errs.pinnedUserId} hint="Selects a cached TikTok session and skips the account picker. If none is found, the normal flow continues.">
                  <input className="input mono" style={{ fontSize: 13 }} value={form.pinned} placeholder="e.g. 6779789250017592326" readOnly={!isAdmin && role !== 'manager'} onChange={e => { setForm(f => ({ ...f, pinned: e.target.value })); setErrs({}); }} />
                </Field>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="tn-chip"><span className="mono">x-oauth-token</span><span style={{ color: 'var(--color-neutral-300)' }}>{moderating ? 'Issued by OAuth flow' : 'Issued when you authorize'}</span></div>
                  <div className="tn-chip" style={{ color: 'var(--color-neutral-500)' }}><span className="mono tn-row-8" style={{ gap: 6 }}><i className="ph ph-lock-simple" />x-cookie-header</span><span>Not accepted in OAuth mode</span></div>
                </div>
              </> : isAdmin ? <>
                <Field label="x-cookie-header" error={errs.cookie} hint={c?.has_cookie ? 'A cookie header is stored encrypted. Paste a new one to replace it.' : undefined}>
                  <textarea className="input mono" style={{ fontSize: 12 }} value={form.cookie} autoComplete="off" placeholder="sessionid=…; tt-target-idc=…" onChange={e => { setForm(f => ({ ...f, cookie: e.target.value })); setErrs({}); }} />
                </Field>
                <div className="tn-chip" style={{ color: 'var(--color-neutral-500)' }}><span className="mono tn-row-8" style={{ gap: 6 }}><i className="ph ph-lock-simple" />x-oauth-token</span><span>Not accepted in Cookie mode</span></div>
              </> : <div className="tn-chip" style={{ justifyContent: 'flex-start', color: 'var(--color-neutral-300)' }}><i className="ph ph-lock-simple" style={{ marginTop: 2 }} />Cookie credentials are only visible to Founders.</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                {isAdmin && c?.status === 'disconnected' && <button type="submit" className="btn btn-primary" disabled={busy !== ''}><i className={busy === 'connect' ? 'ph ph-spinner tn-spin' : 'ph ph-plugs-connected'} />{oauth ? 'Authorize with Euler OAuth' : 'Connect with cookies'}</button>}
                {c?.status === 'authorizing' && <>
                  <button type="button" className="btn btn-primary" disabled><i className="ph ph-spinner tn-spin" />Authorizing…</button>
                  {isAdmin && <button type="button" className="btn btn-secondary" onClick={() => void run('connect', async () => { await api.cancelConnect(agency.id); refresh(); })}>Cancel</button>}
                </>}
                {dirty && !isAdmin && <button type="button" className="btn btn-secondary" disabled={busy !== ''} onClick={() => saveKey()}><i className="ph ph-floppy-disk" />Save changes</button>}
                {moderating && isAdmin && <button type="button" className="btn btn-secondary" disabled={busy !== ''} onClick={() => void run('connect', async () => { await api.disconnect(agency.id); refresh(); toast('Room moderation disconnected. Live data keeps running.'); })}><i className="ph ph-plugs" />End moderation session</button>}
              </div>
            </form>
          )}

          {isAdmin && hasKey && (
            <div className="card elev-sm tn-card gap-3">
              <span className="card-title tn-title-sm">Remove credentials</span>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>Deletes your stored Euler API key, cookie and tokens, and stops live data for this agency. Your ledger stays.</span>
              <button type="button" className="btn btn-secondary btn-destructive" style={{ alignSelf: 'flex-start' }} disabled={busy !== ''} onClick={() => setConfirmDelete(true)}><i className="ph ph-trash" />Delete Euler credentials</button>
            </div>
          )}
          <LedgerSettings />
        </div>

        <div className="tn-col">
          <div className="card elev-sm tn-card">
            <div className="tn-row-8" style={{ gap: 10 }}><Dot color={look.dot} pulse={look.pulse} size={10} /><span style={{ fontSize: 20, fontFamily: 'var(--font-heading)', fontWeight: 500 }}>{look.label}</span><span className="tag tag-neutral">API key</span></div>
            <div className="tnum" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4) var(--space-6)' }}>
              <div className="tn-kv"><span>Room moderation</span><span>{moderating ? c?.account_label ?? 'Connected' : 'Not connected'}</span></div>
              <div className="tn-kv"><span>Moderation for</span><span>{moderating && c?.connected_at ? (since >= 60 ? `${Math.floor(since / 60)}h ${since % 60}m` : `${since}m`) : '—'}</span></div>
              <div className="tn-kv"><span>Events ingested</span><span>{events.toLocaleString('en-US')}</span></div>
              <div className="tn-kv"><span>Last event</span><span>{connected && last ? ago(last, now) : '—'}</span></div>
            </div>
          </div>
          <div className="card elev-sm tn-card gap-3">
            <div className="tn-between"><span className="card-title tn-title-sm">Endpoint URL</span><button className="btn btn-ghost" onClick={() => void copy(url, 'Endpoint URL')}><i className="ph ph-copy" />Copy</button></div>
            <code className="tn-url">{url}</code>
          </div>
          <div className="card elev-sm tn-card gap-3">
            <div className="tn-between"><span className="card-title tn-title-sm">MCP client config</span><div className="tn-row-8" style={{ gap: 'var(--space-2)' }}><Seg small label="Config style" value={cfg} onChange={setCfg} options={[['remote', 'mcp-remote'], ['direct', 'Direct URL']]} /><button className="btn btn-ghost" onClick={() => void copy(configJson, 'Client config')}><i className="ph ph-copy" />Copy</button></div></div>
            <pre className="tn-pre">{configJson}</pre>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>For Claude Desktop, Cursor and other MCP clients. Replace YOUR_API_KEY with your key.</span>
          </div>
          <div className="card elev-sm tn-card">
            <div className="tn-card-head"><span className="card-title tn-title-sm">Tools in use</span><span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{TOOL_GROUPS.reduce((a, g) => a + g.tools.length, 0)} Euler tools</span></div>
            {TOOL_GROUPS.map(g => (
              <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-neutral-300)' }}>{g.name}<span style={{ color: 'var(--color-neutral-500)' }}>used in {g.where}</span>{g.auth && <span className="tag tag-neutral tn-tag-sm">Needs a moderation session ({oauth ? 'x-oauth-token' : 'x-cookie-header'})</span>}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{g.tools.map(t => <Code key={t}>{t}</Code>)}</div>
              </div>
            ))}
          </div>
          <div className="card elev-sm tn-card gap-3">
            <span className="card-title tn-title-sm">Recent tool calls</span>
            {calls.data?.length === 0 && <span style={{ color: 'var(--color-neutral-500)' }}>No calls yet. Look up a creator, open Rankings or moderate a room.</span>}
            {(calls.data ?? []).map(k => (
              <div key={k.id} className="tn-rowline" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 'var(--space-3)', alignItems: 'start', padding: '6px 0' }}>
                <i className={'ph ' + (k.ok ? 'ph-check-circle' : 'ph-x-circle')} style={{ color: k.ok ? 'var(--color-accent-400)' : 'var(--color-neutral-500)', marginTop: 2 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span className="mono" style={{ fontSize: 12 }}>{k.tool}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--color-neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{Object.entries(k.args).map(([a, v]) => `${a}=${v}`).join('  ') || 'no arguments'}</span>
                  {k.error && <span style={{ fontSize: 11, color: 'var(--color-accent-300)' }}>{k.error}</span>}
                  {k.auth && <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>auth via {k.auth}</span>}
                </div>
                <span className="tnum" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{k.ms} ms</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><h2 style={{ fontSize: 20, margin: 0 }}>Live ingestion</h2><span style={{ color: 'var(--color-neutral-400)' }}>Live events arrive over Euler's hosted WebSocket, one socket per target. The SDK prices gifts and mints JWTs.</span></div>
        <div className="tn-grid-2">
          <GiftCatalog />
          <div className="tn-col">
            <div className="card elev-sm tn-card gap-3">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="card-title tn-title-sm">Webcast sockets</span><span className="tn-card-sub">wss://ws.eulerstream.com · one per tracked creator</span></div>
              {mine.map(({ t, st }) => {
                const wl = workerLine(st, now);
                const up = st?.status === 'live' && st.connected_at ? Math.floor((now - Date.parse(st.connected_at)) / 60000) : null;
                return (
                  <div key={t.id} className="tn-rowline" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 'var(--space-3)', alignItems: 'center', padding: '6px 0' }}>
                    <Dot color={st?.status === 'live' ? 'var(--color-accent-400)' : 'var(--color-neutral-600)'} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span>{at(t.unique_id)}</span><span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{up != null ? `Open · ${up >= 60 ? Math.floor(up / 60) + 'h ' : ''}${up % 60}m of 8h` : wl.text}</span></span>
                    <span className="tnum" style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>{st ? Number(st.events_ingested).toLocaleString('en-US') + ' events' : '—'}</span>
                  </div>
                );
              })}
              {mine.length === 0 && <span style={{ color: 'var(--color-neutral-500)' }}>No tracked targets. Add one in Live targets to open a socket.</span>}
            </div>
            <Snippets handle={targets.data?.[0]?.unique_id ?? 'nova_shift'} copy={copy} />
            <div className="card elev-sm tn-card gap-3">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="card-title tn-title-sm">Close codes</span><span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>How TokNomics handles each socket close</span></div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {CLOSE_CODES.map(([code, name, action]) => (
                  <div key={code} className="tn-rowline" style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 'var(--space-3)', padding: '6px 0' }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--color-accent-300)' }}>{code}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}><span className="mono" style={{ fontSize: 11, color: 'var(--color-neutral-400)' }}>{name}</span><span style={{ fontSize: 13, color: 'var(--color-neutral-200)' }}>{action}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Agency cut, conversion rates and the gifter accounts whose gifts count as agency outlay. */
function LedgerSettings() {
  const { agency, role, toast } = useAgency();
  const qc = useQueryClient();
  const accounts = useAccounts(agency.id);
  const [cut, setCut] = useState(String(agency.agency_cut_pct));
  const [coin, setCoin] = useState(String(agency.coin_usd));
  const [dmd, setDmd] = useState(String(agency.diamond_usd));
  const [handle, setHandle] = useState('');
  const [err, setErr] = useState('');
  const canRates = CAN.editSettings(role), canAccounts = CAN.editRoster(role);

  const saveRates = async (e: FormEvent) => {
    e.preventDefault();
    const n = { agency_cut_pct: Number(cut), coin_usd: Number(coin), diamond_usd: Number(dmd) };
    if (!(n.agency_cut_pct >= 0 && n.agency_cut_pct <= 100) || !(n.coin_usd > 0) || !(n.diamond_usd > 0)) return setErr('Cut must be 0–100% and rates above $0');
    const { error } = await supabase.from('agencies').update(n).eq('id', agency.id);
    if (error) return setErr(dbError(error)!.message);
    setErr('');
    void qc.invalidateQueries({ queryKey: keys.memberships });
    toast('Ledger settings saved');
  };
  const addAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!isHandle(handle)) return setErr('Enter a TikTok handle, e.g. @tn.vault');
    const { error } = await supabase.from('agency_accounts').insert({ agency_id: agency.id, unique_id: normalizeUniqueId(handle) });
    if (error) return setErr(dbError(error)!.message);
    setHandle(''); setErr('');
    void qc.invalidateQueries({ queryKey: keys.accounts(agency.id) });
    void qc.invalidateQueries({ queryKey: ['stats', agency.id] });
    void qc.invalidateQueries({ queryKey: ['ledger', agency.id] });
  };
  const removeAccount = async (u: string) => {
    const { error } = await supabase.from('agency_accounts').delete().eq('agency_id', agency.id).eq('unique_id', u);
    if (error) return toast(dbError(error)!.message);
    void qc.invalidateQueries({ queryKey: keys.accounts(agency.id) });
    void qc.invalidateQueries({ queryKey: ['stats', agency.id] });
    void qc.invalidateQueries({ queryKey: ['ledger', agency.id] });
  };

  return (
    <div className="card elev-sm tn-card gap-6">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span className="card-kicker">Ledger</span><span className="card-title">Gifter accounts & rates</span></div>
      <div className="field">
        <label>Agency gifter accounts</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(accounts.data ?? []).map(a => (
            <span key={a.unique_id} className="tag tag-accent" style={{ gap: 6, paddingRight: canAccounts ? 4 : undefined }}>{at(a.unique_id)}
              {canAccounts && <button className="tn-link" aria-label={`Remove ${a.unique_id}`} style={{ display: 'flex', color: 'var(--color-accent-100)' }} onClick={() => void removeAccount(a.unique_id)}><i className="ph ph-x" /></button>}
            </span>
          ))}
          {accounts.data?.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>None yet. Gifts only reach the ledger once their sender is listed here.</span>}
        </div>
        {canAccounts && <form onSubmit={e => void addAccount(e)} style={{ display: 'flex', gap: 'var(--space-2)' }}><input className="input" placeholder="@tn.vault" value={handle} onChange={e => { setHandle(e.target.value); setErr(''); }} aria-label="Gifter account handle" /><button className="btn btn-secondary" style={{ flex: 'none' }}>Add account</button></form>}
      </div>
      <form onSubmit={e => void saveRates(e)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          <Field label="Agency cut %"><input className="input tnum" inputMode="decimal" value={cut} readOnly={!canRates} onChange={e => setCut(e.target.value)} /></Field>
          <Field label="1 coin (USD)"><input className="input tnum" inputMode="decimal" value={coin} readOnly={!canRates} onChange={e => setCoin(e.target.value)} /></Field>
          <Field label="1 diamond (USD)"><input className="input tnum" inputMode="decimal" value={dmd} readOnly={!canRates} onChange={e => setDmd(e.target.value)} /></Field>
        </div>
        {err && <div className="tn-err" role="alert">{err}</div>}
        {canRates && <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>Save rates</button>}
      </form>
    </div>
  );
}

function GiftCatalog() {
  const { agency, role, rates, toast, now } = useAgency();
  const qc = useQueryClient();
  const catalog = useCatalog();
  const usage = useGiftUsage(agency.id);
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const list = (catalog.data ?? []).filter(g => !q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase()));
  const synced = catalog.data?.reduce<string | null>((a, g) => (!a || g.synced_at > a ? g.synced_at : a), null);
  const sync = async () => {
    setSyncing(true);
    try { const r = await api.syncGifts(agency.id); toast(`${r.synced} gifts synced`); void qc.invalidateQueries({ queryKey: keys.catalog }); }
    catch (e) { toast((e as Error).message); }
    finally { setSyncing(false); }
  };
  return (
    <div className="card elev-sm tn-card">
      <div className="tn-between">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="card-title tn-title-sm">Gift catalog</span><span className="tn-card-sub">client.gifts.listWebcastGifts()</span></div>
        {CAN.syncCatalog(role) && <button className="btn btn-secondary" onClick={() => void sync()} disabled={syncing}><i className={syncing ? 'ph ph-arrows-clockwise tn-spin' : 'ph ph-arrows-clockwise'} />Resync</button>}
      </div>
      <div className="tn-between" style={{ gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 220, minHeight: 32 }} placeholder="Filter gifts" value={q} onChange={e => setQ(e.target.value)} aria-label="Filter gifts" />
        <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{catalog.data?.length ? `${catalog.data.length} gifts · synced ${ago(synced, now)}` : 'Not synced'}</span>
      </div>
      {syncing && <div style={{ color: 'var(--color-neutral-500)' }}>Syncing catalog…</div>}
      {catalog.error && <div style={{ color: 'var(--color-neutral-400)' }}>{(catalog.error as Error).message}</div>}
      {!!catalog.data?.length && (
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="table tnum">
            <thead><tr><th>Gift</th><th style={{ textAlign: 'right' }}>Coins</th><th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>Ledger</th></tr></thead>
            <tbody>
              {list.slice(0, 300).map(g => {
                const n = usage.data?.get(g.gift_id) ?? 0;
                return (
                  <tr key={g.gift_id}>
                    <td><div style={{ display: 'flex', flexDirection: 'column' }}><span>{g.name}</span><span className="mono" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>id {g.gift_id}</span></div></td>
                    <td style={{ textAlign: 'right' }}>{g.diamond_count.toLocaleString('en-US')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-neutral-300)' }}>{money(g.diamond_count * rates.coinUsd, 'usd', rates)}</td>
                    <td style={{ textAlign: 'right' }}>{n > 0 && <span className="tag tag-accent">Sent {n}×</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Snippets({ handle, copy }: { handle: string; copy: (t: string, l: string) => void }) {
  const [tab, setTab] = useState<'ws' | 'jwt' | 'connector' | 'sdk'>('ws');
  const [lang, setLang] = useState<'ts' | 'py' | 'cs' | 'java' | 'go'>('ts');
  const text = tab === 'ws' ? SNIP_WS : tab === 'jwt' ? SNIP_JWT : tab === 'connector' ? snipConnector(handle) : lang === 'ts' ? snipSdkTs(handle) : SNIP_SDK[lang];
  return (
    <div className="card elev-sm tn-card gap-3">
      <div className="tn-between"><span className="card-title tn-title-sm">Backend snippet</span><button className="btn btn-ghost" onClick={() => copy(text, 'Snippet')}><i className="ph ph-copy" />Copy</button></div>
      <div style={{ alignSelf: 'flex-start' }}><Seg small mono wrap label="Snippet" value={tab} onChange={setTab} options={[['ws', 'Hosted WebSocket'], ['jwt', 'Frontend JWT'], ['connector', 'tiktok-live-connector'], ['sdk', 'tiktok-live-api-sdk']]} /></div>
      {tab === 'sdk' && <div style={{ alignSelf: 'flex-start' }}><Seg small wrap label="Language" value={lang} onChange={setLang} options={[['ts', 'TypeScript'], ['py', 'Python'], ['cs', 'C#'], ['java', 'Java'], ['go', 'Go']]} /></div>}
      <pre className="tn-pre">{text}</pre>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>Keep the API key server-side. Browsers connect with a short-lived JWT scoped to one creator.</span>
    </div>
  );
}
