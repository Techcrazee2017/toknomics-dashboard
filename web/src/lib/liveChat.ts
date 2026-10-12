// Browser-side live chat for one room over Euler's WebSocket, authenticated by a 60s JWT that the
// API mints per creator (maxWebSockets 1). The API key never reaches the browser.
import { useEffect, useState } from 'react';
import { api } from './api';

// Euler ClientCloseCode values; importing the SDK here would pull the full TikTok protobuf schema into the bundle
const NOT_LIVE = 4404, STREAM_END = 4005;

export type ChatLine = { id: string; userId: string; user: string; comment: string; ts: number };
export type ChatState = { lines: ChatLine[]; status: 'connecting' | 'open' | 'ended' | 'error'; error?: string };

type Frame = { type?: string; data?: { common?: { msgId?: string; createTime?: string }; user?: { userId?: string; uniqueId?: string }; comment?: string } };

export function parseChat(raw: string): ChatLine[] {
  let j: unknown;
  try { j = JSON.parse(raw); } catch { return []; }
  const list: Frame[] = Array.isArray(j) ? j : Array.isArray((j as { messages?: Frame[] })?.messages) ? (j as { messages: Frame[] }).messages : [j as Frame];
  return list.flatMap(m => {
    if (m?.type !== 'WebcastChatMessage' || !m.data?.common?.msgId || !m.data.user?.userId) return [];
    return [{ id: m.data.common.msgId, userId: m.data.user.userId, user: m.data.user.uniqueId ?? m.data.user.userId, comment: m.data.comment ?? '', ts: Number(m.data.common.createTime) || Date.now() }];
  });
}

export function useLiveChat(agencyId: string, uniqueId: string, enabled: boolean): ChatState {
  const [state, setState] = useState<ChatState>({ lines: [], status: 'connecting' });
  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | undefined, dead = false, attempts = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const open = async () => {
      setState(s => ({ ...s, status: 'connecting', error: undefined }));
      try {
        const { url } = await api.wsToken(agencyId, uniqueId);
        if (dead) return;
        ws = new WebSocket(url);
        ws.onopen = () => { attempts = 0; setState(s => ({ ...s, status: 'open' })); };
        ws.onmessage = e => {
          const add = typeof e.data === 'string' ? parseChat(e.data) : [];
          if (add.length) setState(s => ({ ...s, lines: [...add.reverse(), ...s.lines].slice(0, 30) }));
        };
        ws.onclose = e => {
          if (dead) return;
          if (e.code === NOT_LIVE || e.code === STREAM_END) return setState(s => ({ ...s, status: 'ended' }));
          // Expired/invalid JWT or a transient drop: mint a fresh token, with a short backoff
          if (attempts++ < 4) { timer = setTimeout(() => void open(), Math.min(8000, 500 * 2 ** attempts)); return; }
          setState(s => ({ ...s, status: 'error', error: `Chat closed (${e.code})` }));
        };
      } catch (e) {
        if (!dead) setState(s => ({ ...s, status: 'error', error: (e as Error).message }));
      }
    };
    void open();
    return () => { dead = true; clearTimeout(timer); ws?.close(1000); };
  }, [agencyId, uniqueId, enabled]);
  return state;
}
