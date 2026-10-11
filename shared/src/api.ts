// Request/response contracts for the TokNomics API server (backend/src/api).
import { z } from 'zod';
import { PLAN_KEYS } from './constants';
import { NUMERIC_ID, UNIQUE_ID } from './handles';

export const CreateAgencyBody = z.object({ name: z.string().trim().min(2).max(80) });

export const UpdateConnectionBody = z.object({
  mode: z.enum(['oauth', 'cookie']).optional(),
  host: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}(:\d{2,5})?$/, 'Enter a host name, e.g. tiktok.eulerstream.com').optional(),
  apiKey: z.string().trim().min(8, 'That does not look like an Euler API key').max(512).optional(),
  cookie: z.string().trim().max(8192).refine(c => c === '' || /sessionid=/.test(c), 'Paste the raw Cookie header. It must include sessionid=').optional(),
  pinnedUserId: z.union([z.literal(''), z.string().trim().regex(NUMERIC_ID, 'Pinned user ID must be numeric')]).optional(),
});
export type UpdateConnectionBody = z.infer<typeof UpdateConnectionBody>;

export type ConnectResult = { status: 'connected' } | { status: 'authorizing'; authorizeUrl: string };
export type TestResult = { ok: true; ms: number; eventsPerMin: number; rateLimit: { remaining: number; max: number } | null };

export const WsTokenBody = z.object({ unique_id: z.string().trim().toLowerCase().regex(UNIQUE_ID) });
export type WsTokenResult = { url: string; expiresIn: number };

export const InviteBody = z.object({
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  role: z.enum(['manager', 'moderator']),
  teamId: z.uuid().nullable(),
});
export const UpdateMemberBody = z.object({
  role: z.enum(['manager', 'moderator']).optional(),
  teamId: z.uuid().nullable().optional(),
});

export const CheckoutBody = z.object({ plan: z.enum(PLAN_KEYS) });
export type CheckoutResult = { url: string } | { switched: true };

export type GiftSyncResult = { synced: number };

export type ApiError = { error: string; code?: string; fields?: Record<string, string> };
