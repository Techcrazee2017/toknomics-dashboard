// Roster sync: upserting into tracked_targets is the signal the worker listens for (Realtime, 30s reconcile fallback).
// Runs with the user's session, so RLS limits it to Founders and Managers of the agency.
import { normalizeUniqueId } from '@toknomics/shared';
import { supabase } from './supabase';
import { dbError } from './api';

export type TrackInput = {
  agencyId: string; handle: string; source: 'roster' | 'pin' | 'battle';
  kind?: 'stream' | 'battle'; opponent?: string | null; label?: string | null; anchorId?: string | null;
};

export async function trackTarget(o: TrackInput) {
  const row: Record<string, unknown> = {
    agency_id: o.agencyId, unique_id: normalizeUniqueId(o.handle), source: o.source, active: true,
    kind: o.kind ?? 'stream', opponent_unique_id: o.opponent ? normalizeUniqueId(o.opponent) : null, label: o.label || null,
  };
  if (o.anchorId) row.anchor_id = o.anchorId;
  const { data, error } = await supabase.from('tracked_targets').upsert(row, { onConflict: 'agency_id,unique_id' }).select('id').single();
  if (error) throw dbError(error)!;
  return data as { id: string };
}

/** Soft stop keeps gift history; the worker closes the socket once no agency has it active. */
export async function untrackTarget(agencyId: string, uniqueId: string) {
  const { error } = await supabase.from('tracked_targets').update({ active: false }).eq('agency_id', agencyId).eq('unique_id', uniqueId);
  if (error) throw dbError(error)!;
}
