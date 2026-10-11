// Frontend-side roster sync. Runs with the signed-in user's session (anon key + JWT), so RLS applies.
// Call from: Add target stream, Discover/Rankings "Track", roster "Add creator", and stop-tracking.
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export type TargetSource = 'roster' | 'pin' | 'battle';

export function normalizeUniqueId(input: string): string {
  const id = input.trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0].toLowerCase();
  if (!/^[a-z0-9._]{2,24}$/.test(id)) throw new Error(`"${input}" is not a valid TikTok handle`);
  return id;
}

function friendly(error: { code?: string; message: string }): Error {
  if (error.code === '42501') return new Error('Only Founders and Managers can change tracked streams');
  if (error.code === '23514') return new Error('Handle rejected by the database');
  return new Error(error.message);
}

/** Upsert → Realtime notifies the worker, which opens the socket within ~1s (30s reconcile as fallback). */
export async function trackTarget(db: SupabaseClient, o: { agencyId: string; handle: string; source: TargetSource; label?: string }) {
  const unique_id = normalizeUniqueId(o.handle);
  const { data, error } = await db
    .from('tracked_targets')
    .upsert({ agency_id: o.agencyId, unique_id, source: o.source, label: o.label ?? null, active: true }, { onConflict: 'agency_id,unique_id' })
    .select('id, unique_id, active')
    .single();
  if (error) throw friendly(error);
  return data;
}

/** Soft stop keeps gift history; the worker closes the socket once no agency has it active. */
export async function untrackTarget(db: SupabaseClient, o: { agencyId: string; handle: string }) {
  const { error } = await db.from('tracked_targets').update({ active: false })
    .eq('agency_id', o.agencyId).eq('unique_id', normalizeUniqueId(o.handle));
  if (error) throw friendly(error);
}

export type StreamStatus = { unique_id: string; status: string; room_id: string | null; close_code: number | null; next_retry_at: string | null; last_event_at: string | null };

/** Live worker state for the dashboard (connecting → live / offline / backoff). */
export function watchStreamStatus(db: SupabaseClient, onChange: (s: StreamStatus) => void): RealtimeChannel {
  void db.from('stream_status').select('*').then(({ data }) => data?.forEach(onChange));
  return db.channel('stream_status')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_status' }, p => onChange(p.new as StreamStatus))
    .subscribe();
}

/** Exposes the API to the dashboard prototype, which calls window.TokNomicsBackend when present. */
export function installDashboardBridge(db: SupabaseClient, agencyId: string) {
  (globalThis as any).TokNomicsBackend = {
    trackTarget: (handle: string, source: TargetSource, label?: string) => trackTarget(db, { agencyId, handle, source, label }),
    untrackTarget: (handle: string) => untrackTarget(db, { agencyId, handle }),
  };
}
