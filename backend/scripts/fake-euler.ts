// Local stand-in for Euler Stream (REST + WebSocket) so the worker, API and dashboard can run end-to-end
// without an Euler account. Development only: point EULER_API_BASE and EULER_WS_URL at it.
//   npm run fake-euler -w backend          → http://127.0.0.1:8799 and ws://127.0.0.1:8799
// Endpoints/paths mirror tiktok-live-api-sdk 0.6.1; WebSocket frames are v2 ClientMessageBundles.
// Creators whose handle contains "off" are never live; everyone else streams gifts, chat and viewer counts.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT = Number(process.env.FAKE_EULER_PORT ?? 8799);
const AGENCY_SENDERS = (process.env.FAKE_AGENCY_SENDERS ?? 'tn.vault,tn.ops.01').split(',');
const FANS = ['orbit.whale', 'lux.gifts', 'sky.patron', 'zoe.kite', 'rio.mantra'];
const POOL = ['lumen.rise', 'arc.vela', 'zoe.kite', 'marlo_streams', 'indie.pulse', 'onyx_flicker', 'haze_royale', 'nova_shift', 'midnight.wren', 'kairo.dev'];
const GIFTS = [{ id: 5655, name: 'Rose', d: 1, t: 1 }, { id: 5658, name: 'Little Crown', d: 199, t: 1 }, { id: 5659, name: 'Galaxy', d: 1000, t: 2 }, { id: 6369, name: 'Lion', d: 29999, t: 2 }];
const CHAT = ['lets gooo', 'who is winning?', 'that lion was huge', 'free coins at the link in my bio', 'gg', 'tap tap tap'];

const h = (s: string) => parseInt(createHash('sha1').update(s).digest('hex').slice(0, 12), 16);
const numId = (u: string) => '67' + String(h(u)).padStart(17, '0').slice(0, 17);
const roomOf = (u: string) => '74' + String(h(u + ':room')).padStart(17, '0').slice(0, 17);
const isLive = (u: string) => !u.includes('off');
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
let msgSeq = 7_400_000_000_000_000_000n;
const nextMsg = () => String(++msgSeq);

type Room = { comments: boolean; muted: Map<string, string>; banned: Set<string>; mods: Set<string>; words: Map<string, string> };
const rooms = new Map<string, Room>();
const room = (id: string) => rooms.get(id) ?? (rooms.set(id, { comments: true, muted: new Map(), banned: new Set(), mods: new Set([numId('tn.ops.01')]), words: new Map([['w1', 'free coins']]) }), rooms.get(id)!);

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
const userObj = (id: string) => ({ id_str: id, display_id: POOL.find(p => numId(p) === id) ?? 'viewer' + id.slice(-4), nickname: 'Viewer ' + id.slice(-4) });

async function rest(req: IncomingMessage, res: ServerResponse) {
  const u = new URL(req.url ?? '/', 'http://x');
  const p = u.pathname, q = u.searchParams, m = req.method ?? 'GET';
  // OAuth: approve instantly and bounce back with a code (the real flow shows Euler's consent screen)
  if (p === '/oauth/authorize') {
    const back = new URL(q.get('redirect_uri') ?? '');
    back.searchParams.set('code', 'fake-code'); back.searchParams.set('state', q.get('state') ?? '');
    res.writeHead(302, { location: back.toString() }); return res.end();
  }
  const key = req.headers['x-api-key'] ?? q.get('apiKey');
  if (!key) return send(res, 401, { code: 401, message: 'Missing API key' });
  const authed = !!(req.headers['x-oauth-token'] || req.headers['x-cookie-header']);
  let mm: RegExpMatchArray | null;

  if (p === '/tiktok/oauth/token' && m === 'POST') return send(res, 200, { code: 200, data: { access_token: 'fake-access-' + Date.now(), refresh_token: 'fake-refresh', token_type: 'Bearer', expires_in: 3600, refresh_expires_in: 86400, scopes: [] } });
  if (p === '/tiktok/oauth/userinfo') return send(res, 200, { code: 200, user: { uniqueId: 'northlight.ops', uid: numId('northlight.ops') } });
  if (p === '/accounts/me') return send(res, 200, { code: 200, account: { id: 42, name: 'Fake Euler', scopes: [] } });
  if (p === '/accounts/me/rate_limits') return send(res, 200, { code: 200, minute: { max: 600, remaining: 597, reset_at: null } });
  if ((mm = p.match(/^\/accounts\/(\d+)\/jwt\/create$/)) && m === 'POST') return send(res, 200, { code: 200, token: 'fake-jwt-' + Date.now() });
  if ((mm = p.match(/^\/webcast\/anchors\/([^/]+)\/user_id$/))) return send(res, 200, { code: 200, numeric_user_id: numId(mm[1]!) });
  if ((mm = p.match(/^\/tiktok\/users\/([^/]+)\/basic$/))) return send(res, 200, { code: 200, user: { unique_id: mm[1], nickname: mm[1]!.replace(/[._]/g, ' '), region: 'US', avatar_thumb: [], avatar_medium: [], avatar_larger: [] } });
  if ((mm = p.match(/^\/webcast\/anchors\/([^/]+)\/room_id$/))) return send(res, 200, { code: 200, ok: true, routes_attempted: [], is_live: isLive(mm[1]!), room_id: isLive(mm[1]!) ? roomOf(mm[1]!) : undefined });
  if ((mm = p.match(/^\/webcast\/anchors\/([^/]+)\/room_info$/))) return send(res, 200, { code: 200, ok: true, routes_attempted: [], source: null, data: { unique_id: mm[1], user: { unique_id: mm[1], sec_uid: 'MS4wLjABAAAA' + numId(mm[1]!).slice(-8) }, raw: {} } });
  if (p.startsWith('/webcast/feed')) {
    return send(res, 200, { code: 200, region: q.get('region'), response: { data: { status_code: 0, extra: {}, data: POOL.slice(0, 7).map((n, i) => ({ type: 1, rid: String(i), data: { id: 0, id_str: roomOf(n), title: pick(['Late night battles', 'Rank defence', 'PK all night']), user_count: 200 + (h(n) % 9000), stats: { total_user: 0 }, owner: { id: 0, id_str: numId(n), display_id: n, nickname: n } } })) } } });
  }
  if (p === '/webcast/gifts/catalog') return send(res, 200, { code: 200, gifts: GIFTS.map(g => ({ giftId: g.id, giftName: g.name, giftType: g.t, diamondCount: g.d, combo: g.t === 1, forLinkMic: false, describe: '', duration: '', imageUri: '', updatedAt: new Date().toISOString() })), total: GIFTS.length, totalPages: 1 });
  if (p === '/webcast/rankings/catalog/leaderboards') return send(res, 200, { code: 200, regions: { US: { rankings: ['DAILY_RANK', 'FANS_TEAM_RANK', 'SALE_RANK', 'RANKING_LEAGUE'], leagues: ['A1', 'B1'] }, WW: { rankings: ['DAILY_RANK'], leagues: [] } } });
  if ((mm = p.match(/^\/webcast\/rankings\/catalog\/leaderboards\/([^/]+)\/([^/]+)$/))) {
    let score = 2_400_000;
    return send(res, 200, { code: 200, date: q.get('date') ?? new Date().toISOString().slice(0, 10), is_latest: !q.get('date'), ranks: POOL.map((n, i) => ({ rank: i + 1, score: (score = Math.round(score * 0.86)), score_description: '', user: { numeric_id: numId(n), unique_id: n, nickname: n, avatar_url: '', follower_count: 0, following_count: 0, region: 'US' } })) });
  }
  // Moderation: requires the session header the API adds in OAuth/Cookie mode
  if ((mm = p.match(/^\/webcast\/(rooms|anchors)\/([^/]+)\/moderation\/([\w-]+)$/))) {
    if (!authed) return send(res, 401, { code: 401, message: 'x-oauth-token or x-cookie-header required' });
    const r = room(mm[2]!), what = mm[3];
    const list = (ids: Iterable<string>) => send(res, 200, { code: 200, response: { data: { data: [...ids].map(userObj), extra: {}, status_code: 0 } } });
    if (what === 'mutes') { if (m === 'GET') return list(r.muted.keys()); m === 'PUT' ? r.muted.set(q.get('user_id')!, q.get('duration') ?? '') : r.muted.delete(q.get('user_id')!); }
    else if (what === 'bans') { if (m === 'GET') return list(r.banned); m === 'PUT' ? r.banned.add(q.get('tiktok_user_id')!) : r.banned.delete(q.get('tiktok_user_id')!); }
    else if (what === 'moderators') { if (m === 'GET') return list(r.mods); m === 'PUT' ? r.mods.add(q.get('to_user_id')!) : r.mods.delete(q.get('to_user_id')!); }
    else if (what === 'toggle_comments') r.comments = q.get('enabled') === 'true';
    else if (what === 'sensitive-words') {
      if (m === 'GET') return send(res, 200, { code: 200, response: { data: { data: { words: [...r.words].map(([word_id, word]) => ({ word_id, word })) }, extra: {}, status_code: 0 } } });
      m === 'POST' ? r.words.set('w' + Date.now(), q.get('word')!) : r.words.delete(q.get('word_id')!);
    }
    return send(res, 200, { code: 200, response: { data: {} } });
  }
  send(res, 404, { code: 404, message: `fake-euler: no route ${m} ${p}` });
}

const server = createServer((req, res) => { rest(req, res).catch(e => send(res, 500, { code: 500, message: String(e) })); });
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  const q = new URL(req.url ?? '/', 'http://x').searchParams;
  const uid = (q.get('uniqueId') ?? '').replace(/^@/, '');
  if (!q.get('apiKey') && !q.get('jwtKey')) return ws.close(4401, 'Invalid auth');
  if (!uid) return ws.close(4400, 'uniqueId required');
  if (!isLive(uid)) return ws.close(4404, 'Not live');
  const roomId = roomOf(uid);
  ws.send(JSON.stringify({ timestamp: Date.now(), messages: [{ type: 'roomInfo', data: { id_str: roomId, owner: { display_id: uid } } }] }));
  let viewers = 400 + (h(uid) % 4000);
  const t = setInterval(() => {
    const now = Date.now(), messages: unknown[] = [];
    const common = () => ({ msgId: nextMsg(), roomId, createTime: String(now) });
    if (Math.random() < 0.7) {
      const g = pick(GIFTS), agency = Math.random() < 0.35, sender = agency ? pick(AGENCY_SENDERS) : pick(FANS);
      const user = { userId: numId(sender), uniqueId: sender, nickname: sender };
      const n = g.t === 1 ? 1 + Math.floor(Math.random() * 9) : 1;
      if (g.t === 1) for (let i = 1; i < n; i++) messages.push({ type: 'WebcastGiftMessage', data: { common: common(), giftId: g.id, user, repeatCount: i, repeatEnd: 0, giftDetails: { giftName: g.name, diamondCount: g.d, giftType: g.t } } });
      messages.push({ type: 'WebcastGiftMessage', data: { common: common(), giftId: g.id, user, repeatCount: n, repeatEnd: 1, giftDetails: { giftName: g.name, diamondCount: g.d, giftType: g.t } } });
    }
    if (Math.random() < 0.6) { const c = pick(FANS); messages.push({ type: 'WebcastChatMessage', data: { common: common(), user: { userId: numId(c), uniqueId: c }, comment: pick(CHAT) } }); }
    viewers = Math.max(50, viewers + Math.round(Math.random() * 40 - 18));
    messages.push({ type: 'WebcastRoomUserSeqMessage', data: { common: common(), viewerCount: viewers, totalUser: viewers * 3 } });
    ws.send(JSON.stringify({ timestamp: now, messages }));
  }, 1500);
  ws.on('close', () => clearInterval(t));
});

server.listen(PORT, '127.0.0.1', () => console.log(`fake-euler on http://127.0.0.1:${PORT} (REST) and ws://127.0.0.1:${PORT} (WebSocket)`));
