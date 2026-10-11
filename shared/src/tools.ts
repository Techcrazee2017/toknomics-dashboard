// Contract for POST /api/agencies/:agencyId/tools/:tool — the browser never talks to Euler directly.
// Tool names match the Euler MCP tool names shown on the Data source screen; the server maps
// each to the equivalent tiktok-live-api-sdk REST call and normalises the response.
import { z } from 'zod';
import { FEED_REGIONS, LEAGUES, RANK_NAMES } from './constants';
import { NUMERIC_ID, UNIQUE_ID } from './handles';

const uniqueId = z.string().trim().toLowerCase().regex(UNIQUE_ID, 'Enter a TikTok handle');
const numericId = z.string().trim().regex(NUMERIC_ID, 'Enter a numeric TikTok user ID');
const roomId = z.string().trim().regex(/^\d{5,24}$/, 'Invalid room ID');
const page = z.number().int().min(1).max(100).optional();

export const TOOL_INPUTS = {
  get_user_id: z.object({ unique_id: uniqueId }),
  get_user_basic: z.object({ unique_id: uniqueId }),
  get_room_id: z.object({ unique_id: uniqueId }),
  get_live_feed: z.object({ region: z.enum(FEED_REGIONS) }),
  'rankings-get_leaderboard_catalog': z.object({}),
  'rankings-get_leaderboard': z.object({
    region: z.string().regex(/^[A-Z]{2}$/),
    rank_name: z.enum(RANK_NAMES.map(r => r[0]) as [string, ...string[]]),
    league: z.enum(LEAGUES).optional(),
    date: z.iso.date().optional(),
  }),
  toggle_room_comments: z.object({ room_id: roomId, enabled: z.boolean() }),
  'mutes-get_muted_users': z.object({ room_id: roomId, page }),
  'mutes-mute_room_user': z.object({
    room_id: roomId, user_id: numericId,
    duration: z.union([z.literal(-1), z.literal(5), z.literal(30), z.literal(60), z.literal(300)]).optional(),
    comment_msg_id: z.string().regex(/^\d{1,24}$/).optional(),
  }),
  'mutes-unmute_room_user': z.object({ room_id: roomId, user_id: numericId }),
  'bans-get_banned_users': z.object({ room_id: roomId, page }),
  'bans-ban_room_user': z.object({ room_id: roomId, tiktok_user_id: numericId, comment_msg_id: z.string().regex(/^\d{1,24}$/).optional() }),
  'bans-unban_room_user': z.object({ room_id: roomId, tiktok_user_id: numericId }),
  'moderators-get_room_moderators': z.object({ anchor_id: numericId }),
  'moderators-add_room_moderator': z.object({ anchor_id: numericId, to_user_id: numericId }),
  'moderators-remove_room_moderator': z.object({ anchor_id: numericId, to_user_id: numericId }),
  // sec_anchor_id is resolved server-side from the creator's unique_id
  'sensitive_words-get_sensitive_words': z.object({ room_id: roomId, unique_id: uniqueId }),
  'sensitive_words-add_sensitive_word': z.object({ room_id: roomId, unique_id: uniqueId, word: z.string().trim().min(1).max(50) }),
  'sensitive_words-delete_sensitive_word': z.object({ room_id: roomId, unique_id: uniqueId, word_id: z.string().trim().min(1).max(64) }),
} as const;

export type ToolName = keyof typeof TOOL_INPUTS;
export type ToolInput<T extends ToolName> = z.input<(typeof TOOL_INPUTS)[T]>;
export const isToolName = (s: string): s is ToolName => Object.hasOwn(TOOL_INPUTS, s);

/** Tools that act on a room and need the agency's OAuth token or cookie session. */
export const AUTH_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
  'toggle_room_comments', 'mutes-get_muted_users', 'mutes-mute_room_user', 'mutes-unmute_room_user',
  'bans-get_banned_users', 'bans-ban_room_user', 'bans-unban_room_user',
  'moderators-get_room_moderators', 'moderators-add_room_moderator', 'moderators-remove_room_moderator',
  'sensitive_words-get_sensitive_words', 'sensitive_words-add_sensitive_word', 'sensitive_words-delete_sensitive_word',
]);

export type RoomUser = { user_id: string; name: string };
export type FeedRoom = { room_id: string; title: string; viewer_count: number; creator: { unique_id: string; nickname: string; user_id: string } };
export type RankRow = { rank: number; unique_id: string; nickname: string; score: number; numeric_id: string };

export type ToolOutputs = {
  get_user_id: { user_id: string };
  get_user_basic: { unique_id: string; nickname: string; region: string; avatar_url: string | null };
  get_room_id: { room_id: string | null; is_live: boolean };
  get_live_feed: { rooms: FeedRoom[] };
  'rankings-get_leaderboard_catalog': { regions: { region: string; rank_names: string[]; leagues: string[] }[] };
  'rankings-get_leaderboard': { date: string | null; is_latest: boolean; ranks: RankRow[] };
  toggle_room_comments: { ok: true };
  'mutes-get_muted_users': { users: RoomUser[] };
  'mutes-mute_room_user': { ok: true };
  'mutes-unmute_room_user': { ok: true };
  'bans-get_banned_users': { users: RoomUser[] };
  'bans-ban_room_user': { ok: true };
  'bans-unban_room_user': { ok: true };
  'moderators-get_room_moderators': { moderators: RoomUser[] };
  'moderators-add_room_moderator': { ok: true };
  'moderators-remove_room_moderator': { ok: true };
  'sensitive_words-get_sensitive_words': { words: { word_id: string; word: string }[] };
  'sensitive_words-add_sensitive_word': { ok: true };
  'sensitive_words-delete_sensitive_word': { ok: true };
};
export type ToolOutput<T extends ToolName> = ToolOutputs[T];
